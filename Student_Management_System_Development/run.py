import os
import uvicorn
from app.seed import seed_database

if __name__ == "__main__":
    seed_database()
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
