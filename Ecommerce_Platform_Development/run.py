import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting Auspify Atelier Commerce Engine on http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
