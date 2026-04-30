"""
Zoom Server-to-Server OAuth client for the sales-call-analysis skill.

Reads credentials from C:\\Users\\RalphNilssen\\Obsidian\\Claude\\reference\\zoom_api.json:
    {
      "account_id":    "...",
      "client_id":     "...",
      "client_secret": "..."
    }

Usage as a module:
    from zoom_client import ZoomClient
    z = ZoomClient.from_config()
    user = z.resolve_user("lara.forchuk@doxatalent.com")
    convs = z.list_conversations(user["id"], from_date="2026-04-01", to_date="2026-04-30")
    for c in convs:
        full = z.deep_pull(c["conversation_id"])
        vtt  = z.fetch_transcript(c["meeting_uuid"])

Usage as a CLI (for ad hoc debugging):
    python zoom_client.py token
    python zoom_client.py user lara.forchuk@doxatalent.com
    python zoom_client.py list <user_id> 2026-04-01 2026-04-30
    python zoom_client.py deep <conversation_id>
    python zoom_client.py vtt <meeting_uuid>
"""
from __future__ import annotations
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

CONFIG_PATH_DEFAULT = r"C:\Users\RalphNilssen\Obsidian\Claude\reference\zoom_api.json"
BASE = "https://api.zoom.us/v2"
TOKEN_URL = "https://zoom.us/oauth/token"


class ZoomError(Exception):
    pass


def _http(method: str, url: str, headers: dict | None = None, data: bytes | None = None,
          timeout: int = 30) -> tuple[int, str]:
    req = urllib.request.Request(url, method=method, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def _double_encode(s: str) -> str:
    return urllib.parse.quote(urllib.parse.quote(s, safe=""), safe="")


def _retry(fn, attempts: int = 3, base_delay: float = 0.5):
    """Retry on 429 and 5xx with exponential backoff."""
    last = None
    for i in range(attempts):
        status, body = fn()
        last = (status, body)
        if status < 400 or status in (401, 403, 404):
            return status, body
        time.sleep(base_delay * (2 ** i))
    return last


class ZoomClient:
    def __init__(self, account_id: str, client_id: str, client_secret: str):
        self.account_id = account_id
        self.client_id = client_id
        self.client_secret = client_secret
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    # ---- construction ----------------------------------------------------

    @classmethod
    def from_config(cls, path: str | None = None) -> "ZoomClient":
        path = path or os.environ.get("ZOOM_CONFIG_PATH") or CONFIG_PATH_DEFAULT
        # Support env-var override for ad hoc runs without a config file.
        if not os.path.exists(path):
            aid = os.environ.get("ZOOM_ACCOUNT_ID")
            cid = os.environ.get("ZOOM_CLIENT_ID")
            sec = os.environ.get("ZOOM_CLIENT_SECRET")
            if aid and cid and sec:
                return cls(aid, cid, sec)
            raise ZoomError(
                f"Zoom credentials not found. Expected JSON at {path} or env vars "
                "ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET."
            )
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        for k in ("account_id", "client_id", "client_secret"):
            if not cfg.get(k):
                raise ZoomError(f"Config at {path} is missing '{k}'.")
        return cls(cfg["account_id"], cfg["client_id"], cfg["client_secret"])

    # ---- token -----------------------------------------------------------

    def _ensure_token(self) -> str:
        if self._token and time.time() < self._token_expires_at - 60:
            return self._token
        auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        body = urllib.parse.urlencode({
            "grant_type": "account_credentials",
            "account_id": self.account_id,
        }).encode()
        s, p = _http("POST", TOKEN_URL, headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        }, data=body)
        if s != 200:
            raise ZoomError(f"Token request failed [{s}]: {p}")
        d = json.loads(p)
        self._token = d["access_token"]
        self._token_expires_at = time.time() + int(d.get("expires_in", 3600))
        return self._token

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._ensure_token()}"}

    # ---- users -----------------------------------------------------------

    def resolve_user(self, email: str) -> dict:
        """Resolve an email to a Zoom user record. Returns dict with id, email, name.
        Uses the user list endpoint (only scope granted is user:read:list_users:admin)."""
        page_token = ""
        for _ in range(20):
            params: dict[str, Any] = {"page_size": 300, "status": "active"}
            if page_token:
                params["next_page_token"] = page_token
            url = f"{BASE}/users?{urllib.parse.urlencode(params)}"
            s, p = _retry(lambda: _http("GET", url, headers=self._auth_headers()))
            if s != 200:
                raise ZoomError(f"User list failed [{s}]: {p}")
            d = json.loads(p)
            for u in d.get("users", []):
                if (u.get("email") or "").lower() == email.lower():
                    return {
                        "id": u["id"],
                        "email": u.get("email"),
                        "name": f"{u.get('first_name','')} {u.get('last_name','')}".strip(),
                    }
            page_token = d.get("next_page_token", "")
            if not page_token:
                break
        raise ZoomError(f"User not found in active user list: {email}")

    # ---- conversations ---------------------------------------------------

    def list_conversations(self, user_id: str, from_date: str, to_date: str) -> list[dict]:
        """List ZRA conversations for a user in a date window. YYYY-MM-DD."""
        out = []
        page_token = ""
        for _ in range(50):
            params = {
                "from": from_date, "to": to_date,
                "user_id": user_id, "page_size": 100,
            }
            if page_token:
                params["next_page_token"] = page_token
            url = f"{BASE}/zra/conversations?{urllib.parse.urlencode(params)}"
            s, p = _retry(lambda: _http("GET", url, headers=self._auth_headers()))
            if s != 200:
                raise ZoomError(f"List conversations failed [{s}]: {p}")
            d = json.loads(p)
            out.extend(d.get("conversations", []))
            page_token = d.get("next_page_token", "")
            if not page_token:
                break
        return out

    def deep_pull(self, conversation_id: str) -> dict:
        """Pull the full conversation analysis payload."""
        cid = _double_encode(conversation_id)
        url = f"{BASE}/zra/conversations/{cid}"
        s, p = _retry(lambda: _http("GET", url, headers=self._auth_headers()))
        if s != 200:
            raise ZoomError(f"Deep pull failed [{s}] for {conversation_id}: {p[:300]}")
        return json.loads(p)

    def get_scorecards(self, conversation_id: str) -> list[dict]:
        cid = _double_encode(conversation_id)
        url = f"{BASE}/zra/conversations/{cid}/scorecards"
        s, p = _retry(lambda: _http("GET", url, headers=self._auth_headers()))
        if s != 200:
            return []
        return json.loads(p).get("scorecards", []) or []

    # ---- recording / transcript ------------------------------------------

    def list_recording_files(self, meeting_uuid: str) -> list[dict]:
        """Return recording_files for a meeting. Double-encodes UUID per Zoom rules."""
        uuid_enc = _double_encode(meeting_uuid)
        url = f"{BASE}/meetings/{uuid_enc}/recordings"
        s, p = _retry(lambda: _http("GET", url, headers=self._auth_headers()))
        if s != 200:
            return []
        return json.loads(p).get("recording_files", []) or []

    def fetch_transcript(self, meeting_uuid: str) -> str | None:
        """Download the meeting's TRANSCRIPT VTT and return raw VTT text. None if absent."""
        files = self.list_recording_files(meeting_uuid)
        target = None
        for f in files:
            if f.get("file_type") == "TRANSCRIPT" or f.get("recording_type") == "audio_transcript":
                target = f
                break
        if not target:
            return None
        download_url = target.get("download_url")
        if not download_url:
            return None
        # Bearer token auth on the download URL.
        s, p = _http("GET", download_url, headers=self._auth_headers())
        if s != 200:
            return None
        return p


# ---- VTT parsing -----------------------------------------------------------

VTT_TIME_RE = re.compile(r"^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->")
VTT_SPEAKER_RE = re.compile(r"^([^:]+):\s*(.*)$")


def vtt_to_transcript(vtt_text: str) -> str:
    """Convert Zoom VTT to '[Speaker] {HH:MM:SS} text' format used by the skill."""
    if not vtt_text:
        return ""
    lines = vtt_text.splitlines()
    out_blocks = []
    i = 0
    current_ts = None
    while i < len(lines):
        line = lines[i].strip()
        m = VTT_TIME_RE.match(line)
        if m:
            current_ts = f"{m.group(1)}:{m.group(2)}:{m.group(3)}"
            # next non-empty lines until blank are the cue payload
            j = i + 1
            payload = []
            while j < len(lines) and lines[j].strip():
                payload.append(lines[j].strip())
                j += 1
            text = " ".join(payload)
            speaker = "Unknown"
            sm = VTT_SPEAKER_RE.match(text)
            if sm:
                speaker = sm.group(1).strip()
                text = sm.group(2).strip()
            if text:
                out_blocks.append(f"[{speaker}] {{{current_ts}}} {text}")
            i = j
        else:
            i += 1
    return "\n".join(out_blocks)


# ---- Date utilities (US business weeks) ------------------------------------

def us_business_week(d):
    """Return (week_num, sun_start, sat_end) for the Sun-Sat US business week
    containing date d. Week 1 of any year = the Sun-Sat week containing Jan 1.

    Example: April 27, 2026 (Mon) → (18, date(2026,4,26), date(2026,5,2)).
    """
    from datetime import date as _date, timedelta as _td
    weekday = d.weekday()                         # Mon=0 ... Sun=6
    days_back_to_sun = (weekday + 1) % 7          # Sun=0 days back
    sun_start = d - _td(days=days_back_to_sun)
    sat_end = sun_start + _td(days=6)
    jan1 = _date(d.year, 1, 1)
    jan1_back = (jan1.weekday() + 1) % 7
    jan1_sun = jan1 - _td(days=jan1_back)         # Sunday on/before Jan 1
    week_num = ((sun_start - jan1_sun).days // 7) + 1
    return week_num, sun_start, sat_end


def last_n_business_weeks(today, n=6):
    """Return list of n dicts (oldest first) covering the n most recent US
    business weeks ending the week containing 'today'. Each dict has:
      num, sun_start, sat_end, label (e.g., 'Apr 5-11' or 'Mar 29-Apr 4').
    """
    from datetime import timedelta as _td
    _, current_sun, _ = us_business_week(today)
    weeks = []
    for i in range(n - 1, -1, -1):
        s = current_sun - _td(days=7 * i)
        e = s + _td(days=6)
        wn, _, _ = us_business_week(s)
        if s.month == e.month:
            label = f"{s.strftime('%b')} {s.day}-{e.day}"
        else:
            label = f"{s.strftime('%b')} {s.day}-{e.strftime('%b')} {e.day}"
        weeks.append({"num": wn, "sun_start": s, "sat_end": e, "label": label})
    return weeks


# ---- CLI -------------------------------------------------------------------

def _cli():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    z = ZoomClient.from_config()
    if cmd == "token":
        print(z._ensure_token()[:24] + "...")
    elif cmd == "user":
        print(json.dumps(z.resolve_user(sys.argv[2]), indent=2))
    elif cmd == "list":
        user_id, frm, to = sys.argv[2], sys.argv[3], sys.argv[4]
        convs = z.list_conversations(user_id, frm, to)
        print(f"{len(convs)} conversations")
        for c in convs[:5]:
            print(f"  {c.get('meeting_start_time')}  {c.get('conversation_topic')[:60]}")
    elif cmd == "deep":
        print(json.dumps(z.deep_pull(sys.argv[2]), indent=2, default=str)[:2000])
    elif cmd == "vtt":
        vtt = z.fetch_transcript(sys.argv[2])
        print(vtt[:1500] if vtt else "no transcript")
        if vtt:
            print("\n--- parsed ---\n")
            print(vtt_to_transcript(vtt)[:1500])
    else:
        print(f"unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    _cli()
