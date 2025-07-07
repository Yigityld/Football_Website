import uvicorn  # type: ignore
from main import app  # type: ignore

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
# backend çalıştırma : uvicorn main:app --reload --host 0.0.0.0 --port 8000
# frontend çalıştırma : npm start
