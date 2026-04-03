#!/bin/bash

# Test the new classification system with three emails

echo "========================================="
echo "TEST 1: Product usage - drawers hard to open"
echo "========================================="

curl -X POST http://localhost:5173/api/test-classification \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "The drawers are really hard to open, is this normal?",
    "body_plain": "The drawers are really hard to open, is this normal? I am worried there might be something wrong with my stand.",
    "from_name": "Sarah"
  }' | python -m json.tool

echo ""
echo "========================================="
echo "TEST 2: Spam - collaboration opportunity"
echo "========================================="

curl -X POST http://localhost:5173/api/test-classification \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Quick collaboration opportunity",
    "body_plain": "Let us jump on a call to discuss a guaranteed 10x revenue opportunity for your business.",
    "from_name": "Marketing Agency"
  }' | python -m json.tool

echo ""
echo "========================================="
echo "TEST 3: Damaged - boxes arrived with marks"
echo "========================================="

curl -X POST http://localhost:5173/api/test-classification \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "My boxes arrived with marks and dents",
    "body_plain": "I just received my order and several of the boxes have marks and dents on them, particularly the ones in the corner of the packaging.",
    "from_name": "Emma"
  }' | python -m json.tool

echo ""
echo "========================================="
echo "All tests complete"
echo "========================================="
