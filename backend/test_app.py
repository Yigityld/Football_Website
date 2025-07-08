from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Test API çalışıyor", "status": "ok"}

@app.get("/test")
async def test():
    return {"message": "Test endpoint çalışıyor", "cors": "enabled"}

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Backend çalışıyor"} 