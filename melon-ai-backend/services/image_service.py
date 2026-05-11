import torch
from diffusers import StableDiffusionPipeline
import os

model_id = "runwayml/stable-diffusion-v1-5"

# Initialize global pipeline (lazily or once to avoid reloading per request)
pipe = None

def get_pipe():
    global pipe
    if pipe is None:
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32
        )
        if torch.cuda.is_available():
            pipe = pipe.to("cuda")
        else:
            pipe = pipe.to("cpu")
    return pipe

def generate_image(prompt: str, filename: str) -> str:
    """Generates an image via stable diffusion from runwayml"""
    p = get_pipe()
    image = p(prompt).images[0]
    
    os.makedirs("uploads/images", exist_ok=True)
    filepath = f"uploads/images/{filename}"
    image.save(filepath)
    
    # Return a URL path that frontend can use (assuming static files are mounted)
    return f"/static/images/{filename}"

generate_image("A cartoon illustration of kids learning about photosynthesis", "test_image.png")