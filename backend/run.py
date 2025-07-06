import uvicorn  # type: ignore
from main import app  # type: ignore

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, reload=True)
