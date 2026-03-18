import sys, torch, transformers, json
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
model_name = "sentence-transformers/all-MiniLM-L6-v2"
tokenizer = transformers.AutoTokenizer.from_pretrained(model_name)
model = transformers.AutoModel.from_pretrained(model_name).to(device)
def embed(text):
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True).to(device)
    with torch.no_grad():
        out = model(**inputs)
    # 벡터 추출 후 수파베이스 규격(1536차원)에 맞게 확장
    vect = out.last_hidden_state.mean(dim=1).squeeze().tolist()
    padded_vect = vect + [0.0] * (1536 - len(vect))
    return padded_vect

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # n8n에서 보내주는 텍스트 받기
        texts = sys.argv[1].split("||")
        embeds = [embed(t) for t in texts]
        print(json.dumps(embeds))
