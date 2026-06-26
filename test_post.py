import requests

url = "https://ai-documentation-baackend.onrender.com/api/crawl"
headers = {
    "Content-Type": "application/json",
    "Origin": "https://ai-document-search-engine.vercel.app"
}
payload = {
    "url": "https://fastapi.tiangolo.com/tutorial/middleware/",
    "max_pages": 10,
    "limit_domain": True
}

try:
    print("Sending POST request to:", url)
    response = requests.post(url, json=payload, headers=headers)
    print("Status Code:", response.status_code)
    print("Headers:")
    for k, v in response.headers.items():
        print(f"  {k}: {v}")
    print("Body:", response.text)
except Exception as e:
    print("Error:", e)
