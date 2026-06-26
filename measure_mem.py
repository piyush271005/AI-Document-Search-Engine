import sys
import os
import psutil

process = psutil.Process(os.getpid())
print(f"Base Memory usage: {process.memory_info().rss / 1024 / 1024:.2f} MB")

import fastapi
print(f"After importing fastapi: {process.memory_info().rss / 1024 / 1024:.2f} MB")

import chromadb
print(f"After importing chromadb: {process.memory_info().rss / 1024 / 1024:.2f} MB")

import sentence_transformers
print(f"After importing sentence_transformers: {process.memory_info().rss / 1024 / 1024:.2f} MB")

from sentence_transformers import SentenceTransformer
model = SentenceTransformer("all-MiniLM-L6-v2")
print(f"After loading model: {process.memory_info().rss / 1024 / 1024:.2f} MB")
