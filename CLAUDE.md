# Best Wishes Development Guidelines

## Architecture Notes

### SSE Streaming Through Cloudflare

Cloudflare has a ~100 second proxy timeout. Long-running operations MUST emit SSE events regularly to keep connections alive.

**Pattern for long-running operations:**

```python
# BAD - blocks for 60+ seconds, Cloudflare times out
def generate_thing():
    result = slow_api_call()  # blocks
    return result

# GOOD - yields progress events during polling
def generate_thing_stream():
    operation = start_async_operation()
    while not operation.done:
        yield ('progress', poll_count, max_polls)  # keepalive
        time.sleep(10)
        operation = poll_operation()
    yield ('complete', result)

# Keep blocking wrapper for tests/scripts
def generate_thing():
    for event_type, *data in generate_thing_stream():
        if event_type == 'complete':
            return data[0]
    return None
```

**Files using this pattern:**
- `backend/card_generation.py`: `generate_card_stream()` (to be implemented)

### Google GenAI SDK Notes

- `types.Image.from_file()` requires keyword arg: `from_file(location=path)`
- Image generation uses Gemini 2.0 Flash with image output
- Card designs should be generated at 300 DPI for print quality

### Testing

- Unit tests: `pytest tests/` (mocked, fast)
- Integration tests: `pytest -m integration tests/` (live API, slow)
- Integration tests catch SDK API issues that mocks miss

## Infrastructure

- Runs behind Cloudflare proxy
- Nginx reverse proxy on server
- Backend: FastAPI on port 8001
- Frontend: Next.js on port 3000

## Project Structure

```
bestwishes/
├── backend/
│   ├── main.py           # FastAPI app, routes
│   ├── database.py       # SQLite operations
│   ├── card_generation.py # Card image generation (TBD)
│   ├── auth_utils.py     # JWT authentication
│   └── user_auth.py      # Signup/login endpoints
├── frontend/
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   └── contexts/         # Auth context
└── *.sh                  # Production scripts
```
