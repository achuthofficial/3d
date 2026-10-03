# bridge.py: tiny local service the CEP panel calls for generation
import base64, pathlib, uuid

from fastapi import FastAPI
from openai import OpenAI

app, client = FastAPI(), OpenAI()
CACHE = pathlib.Path.home() / ".pattern-baker"
CACHE.mkdir(exist_ok=True)

@app.post("/pattern")
def pattern(prompt: str):
    img = client.images.generate(
        model="gpt-image-1",
        prompt=f"{prompt}, seamless repeating tile, flat colours, crisp edges",
        size="1024x1024",
    )
    path = CACHE / f"{uuid.uuid4()}.png"
    path.write_bytes(base64.b64decode(img.data[0].b64_json))
    return {"path": str(path)}          # → traceToBrand(path, 4, "Brand")
