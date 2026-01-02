import sqlite3
import time
import json
import uuid
import base64
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "bestwishes.db")


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """Initialize database tables if they don't exist."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1,
                is_admin INTEGER DEFAULT 0
            )
        """)

        # Create cards table - user's created card designs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                prompt TEXT NOT NULL,
                occasion TEXT,
                style TEXT,
                image_data BLOB,
                image_mime TEXT,
                image_variants_json TEXT,
                base_message TEXT,
                status TEXT DEFAULT 'draft',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Create card_jobs table for async card generation tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS card_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                job_id TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'pending',
                prompt TEXT,
                occasion TEXT,
                style TEXT,
                photo_count INTEGER DEFAULT 0,
                variants_json TEXT,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Create card_job_events table for SSE event replay
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS card_job_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                event_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (job_id) REFERENCES card_jobs(id) ON DELETE CASCADE
            )
        """)

        # Create examples table - curated inspiration gallery
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS examples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT NOT NULL,
                occasion TEXT,
                style_tags_json TEXT,
                image_data BLOB,
                image_mime TEXT,
                is_featured INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        """)

        # Set admin flag for the admin email
        cursor.execute("""
            UPDATE users SET is_admin = 1 WHERE email = 'email.djhope@gmail.com'
        """)

        conn.commit()


# ===== USER FUNCTIONS =====

def create_user(email: str, hashed_password: str) -> int:
    """Create a new user and return their ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (email, hashed_password, created_at)
            VALUES (?, ?, ?)
        """, (email, hashed_password, int(time.time())))
        return cursor.lastrowid


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve a user by email."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a user by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def is_user_admin(user_id: int) -> bool:
    """Check if a user has admin privileges."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return bool(row and row[0])


# ===== CARD FUNCTIONS =====

def create_card(user_id: int, prompt: str, occasion: str = None, style: str = None,
                image_data: bytes = None, image_mime: str = None,
                base_message: str = None) -> int:
    """Create a new card and return its ID."""
    now = int(time.time())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO cards (user_id, prompt, occasion, style, image_data, image_mime,
                              base_message, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
        """, (user_id, prompt, occasion, style, image_data, image_mime, base_message, now, now))
        return cursor.lastrowid


def get_card(card_id: int, user_id: int = None) -> Optional[Dict[str, Any]]:
    """Retrieve a card by ID, optionally checking user ownership."""
    with get_db() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("SELECT * FROM cards WHERE id = ? AND user_id = ?", (card_id, user_id))
        else:
            cursor.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
        row = cursor.fetchone()
        if not row:
            return None

        card = dict(row)
        # Convert image to base64 for API response
        if card.get('image_data'):
            card['image_base64'] = base64.b64encode(card['image_data']).decode('utf-8')
        # Parse variants JSON
        if card.get('image_variants_json'):
            card['image_variants'] = json.loads(card['image_variants_json'])
        return card


def get_user_cards(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Get all cards for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, prompt, occasion, style, base_message, status, created_at, updated_at
            FROM cards
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit))
        return [dict(row) for row in cursor.fetchall()]


def update_card(card_id: int, user_id: int, **kwargs) -> bool:
    """Update a card. Returns True if updated."""
    allowed_fields = ['prompt', 'occasion', 'style', 'image_data', 'image_mime',
                      'image_variants_json', 'base_message', 'status']

    updates = []
    params = []
    for field in allowed_fields:
        if field in kwargs:
            updates.append(f"{field} = ?")
            params.append(kwargs[field])

    if not updates:
        return False

    updates.append("updated_at = ?")
    params.append(int(time.time()))
    params.extend([card_id, user_id])

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE cards SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
        """, params)
        return cursor.rowcount > 0


def delete_card(card_id: int, user_id: int) -> bool:
    """Delete a card. Returns True if deleted."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cards WHERE id = ? AND user_id = ?", (card_id, user_id))
        return cursor.rowcount > 0


# ===== CARD JOB FUNCTIONS (for async generation) =====

def create_card_job(user_id: int, prompt: str, occasion: str = None,
                    style: str = None, photo_count: int = 0) -> tuple[int, str]:
    """Create a card generation job. Returns (job_id, job_uuid)."""
    now = int(time.time())
    job_uuid = str(uuid.uuid4())

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO card_jobs (user_id, job_id, status, prompt, occasion, style,
                                  photo_count, created_at, updated_at)
            VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)
        """, (user_id, job_uuid, prompt, occasion, style, photo_count, now, now))
        return cursor.lastrowid, job_uuid


def get_card_job(job_id: int = None, job_uuid: str = None, user_id: int = None) -> Optional[Dict[str, Any]]:
    """Retrieve a card job by ID or UUID."""
    with get_db() as conn:
        cursor = conn.cursor()

        if job_uuid:
            if user_id:
                cursor.execute("SELECT * FROM card_jobs WHERE job_id = ? AND user_id = ?",
                              (job_uuid, user_id))
            else:
                cursor.execute("SELECT * FROM card_jobs WHERE job_id = ?", (job_uuid,))
        elif job_id:
            if user_id:
                cursor.execute("SELECT * FROM card_jobs WHERE id = ? AND user_id = ?",
                              (job_id, user_id))
            else:
                cursor.execute("SELECT * FROM card_jobs WHERE id = ?", (job_id,))
        else:
            return None

        row = cursor.fetchone()
        if not row:
            return None

        job = dict(row)
        if job.get('variants_json'):
            job['variants'] = json.loads(job['variants_json'])
        return job


def update_card_job(job_id: int, status: str = None, variants_json: str = None,
                    error_message: str = None) -> bool:
    """Update a card job."""
    updates = ["updated_at = ?"]
    params = [int(time.time())]

    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if variants_json is not None:
        updates.append("variants_json = ?")
        params.append(variants_json)
    if error_message is not None:
        updates.append("error_message = ?")
        params.append(error_message)

    params.append(job_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE card_jobs SET {', '.join(updates)} WHERE id = ?
        """, params)
        return cursor.rowcount > 0


def get_user_card_jobs(user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent card jobs for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, job_id, status, prompt, occasion, style, photo_count,
                   error_message, created_at, updated_at
            FROM card_jobs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit))
        return [dict(row) for row in cursor.fetchall()]


# ===== CARD JOB EVENTS (for SSE replay) =====

def save_job_event(job_id: int, event_json: str) -> int:
    """Save a job event for SSE replay. Returns event ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO card_job_events (job_id, event_json, created_at)
            VALUES (?, ?, ?)
        """, (job_id, event_json, int(time.time())))
        return cursor.lastrowid


def get_job_events_since(job_id: int, last_event_id: int = 0) -> List[tuple]:
    """Get all events for a job after the given event ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, event_json
            FROM card_job_events
            WHERE job_id = ? AND id > ?
            ORDER BY id ASC
        """, (job_id, last_event_id))
        return [(row['id'], row['event_json']) for row in cursor.fetchall()]


def cleanup_job_events(job_id: int) -> int:
    """Delete all events for a completed job. Returns count deleted."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM card_job_events WHERE job_id = ?", (job_id,))
        return cursor.rowcount


# ===== EXAMPLES FUNCTIONS =====

def create_example(prompt: str, occasion: str = None, style_tags: List[str] = None,
                   image_data: bytes = None, image_mime: str = None,
                   is_featured: bool = False) -> int:
    """Create an example card for the gallery."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO examples (prompt, occasion, style_tags_json, image_data,
                                 image_mime, is_featured, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (prompt, occasion, json.dumps(style_tags) if style_tags else None,
              image_data, image_mime, 1 if is_featured else 0, int(time.time())))
        return cursor.lastrowid


def get_examples(occasion: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get examples from the gallery, optionally filtered by occasion."""
    with get_db() as conn:
        cursor = conn.cursor()

        if occasion:
            cursor.execute("""
                SELECT id, prompt, occasion, style_tags_json, image_mime, is_featured, created_at
                FROM examples
                WHERE occasion = ?
                ORDER BY is_featured DESC, created_at DESC
                LIMIT ?
            """, (occasion, limit))
        else:
            cursor.execute("""
                SELECT id, prompt, occasion, style_tags_json, image_mime, is_featured, created_at
                FROM examples
                ORDER BY is_featured DESC, created_at DESC
                LIMIT ?
            """, (limit,))

        examples = []
        for row in cursor.fetchall():
            example = dict(row)
            if example.get('style_tags_json'):
                example['style_tags'] = json.loads(example['style_tags_json'])
            examples.append(example)
        return examples


def get_example(example_id: int) -> Optional[Dict[str, Any]]:
    """Get a single example with full image data."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM examples WHERE id = ?", (example_id,))
        row = cursor.fetchone()
        if not row:
            return None

        example = dict(row)
        if example.get('image_data'):
            example['image_base64'] = base64.b64encode(example['image_data']).decode('utf-8')
        if example.get('style_tags_json'):
            example['style_tags'] = json.loads(example['style_tags_json'])
        return example


# ===== ADMIN FUNCTIONS =====

def get_all_users(page: int = 1, per_page: int = 20) -> dict:
    """Get paginated users for admin view."""
    offset = (page - 1) * per_page
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        total = cursor.fetchone()[0]
        cursor.execute("""
            SELECT id, email, created_at, is_active, is_admin
            FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, (per_page, offset))
        users = [dict(row) for row in cursor.fetchall()]
        return {
            "items": users,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        }


def get_all_cards(page: int = 1, per_page: int = 20) -> dict:
    """Get paginated cards for admin view."""
    offset = (page - 1) * per_page
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cards")
        total = cursor.fetchone()[0]
        cursor.execute("""
            SELECT c.id, c.prompt, c.occasion, c.style, c.status, c.created_at, u.email
            FROM cards c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        """, (per_page, offset))
        cards = [dict(row) for row in cursor.fetchall()]
        return {
            "items": cards,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        }


def get_admin_stats() -> dict:
    """Get admin dashboard statistics."""
    today_start = int(time.time()) - (int(time.time()) % 86400)

    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM cards")
        total_cards = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM cards WHERE created_at >= ?", (today_start,))
        cards_today = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM examples")
        total_examples = cursor.fetchone()[0]

        return {
            "total_users": total_users,
            "total_cards": total_cards,
            "cards_today": cards_today,
            "total_examples": total_examples
        }


# ===== CLEANUP FUNCTIONS =====

def cleanup_old_card_jobs(hours: int = 24) -> int:
    """Delete card jobs older than specified hours. Returns count deleted."""
    cutoff_time = int(time.time()) - (hours * 3600)

    with get_db() as conn:
        cursor = conn.cursor()

        # Get job IDs to delete
        cursor.execute("SELECT id FROM card_jobs WHERE created_at < ?", (cutoff_time,))
        job_ids = [row[0] for row in cursor.fetchall()]

        if job_ids:
            # Delete events first
            cursor.execute(f"""
                DELETE FROM card_job_events WHERE job_id IN ({','.join('?' * len(job_ids))})
            """, job_ids)

            # Delete jobs
            cursor.execute("DELETE FROM card_jobs WHERE created_at < ?", (cutoff_time,))

        return len(job_ids)


def run_cleanup(job_hours: int = 24) -> dict:
    """Run all cleanup routines."""
    jobs_deleted = cleanup_old_card_jobs(job_hours)
    return {"card_jobs_deleted": jobs_deleted}
