#!/bin/bash

echo "=== TESTING 10 EMAILS THROUGH PRODUCTION API ==="
echo ""

# Email 1: Shipping delay
echo "1. SHIPPING DELAY TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "anna@example.com",
    "subject": "Order hasn'\''t arrived yet",
    "body_plain": "Hi,\n\nI ordered one of your storage cases about 8 days ago and haven'\''t received any updates since.\n\nCould you please check where it is?\n\nThank you,\nAnna",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Anna"
  }'
echo -e "\n"

# Email 2: Damaged product
echo "2. DAMAGED PRODUCT TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "michael@example.com",
    "subject": "Issue with my order",
    "body_plain": "Hi,\n\nMy order arrived today but unfortunately the lid is scratched and doesn'\''t close properly.\n\nIt'\''s a beautiful piece otherwise, so I'\''d really appreciate your help resolving this.\n\nKind regards,\nMichael",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Michael"
  }'
echo -e "\n"

# Email 3: Pre-purchase
echo "3. PRE-PURCHASE TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "david@example.com",
    "subject": "Question before purchasing",
    "body_plain": "Hi,\n\nI'\''m considering purchasing one of your organisers and wanted to ask if it'\''s suitable for watches as well as jewellery?\n\nThanks so much,\nDavid",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "David"
  }'
echo -e "\n"

# Email 4: Returns
echo "4. RETURNS TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "sophie@example.com",
    "subject": "Return request",
    "body_plain": "Hi,\n\nI received my order but it'\''s not quite what I was expecting.\n\nCould you please let me know how to arrange a return?\n\nBest,\nSophie",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Sophie"
  }'
echo -e "\n"

# Email 5: Cancellation
echo "5. CANCELLATION TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "chris@example.com",
    "subject": "Cancel my order please",
    "body_plain": "Hi,\n\nI just placed an order but need to cancel it urgently.\n\nCan you stop it before it ships?\n\nThanks,\nChris",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Chris"
  }'
echo -e "\n"

# Email 6: Billing
echo "6. BILLING TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "rachel@example.com",
    "subject": "Charged twice?",
    "body_plain": "Hi,\n\nI think I may have been charged twice for my order.\n\nCan you please confirm and assist?\n\nThanks,\nRachel",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Rachel"
  }'
echo -e "\n"

# Email 7: Wholesale
echo "7. WHOLESALE TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "isabella@example.com",
    "subject": "Retail partnership enquiry",
    "body_plain": "Hi,\n\nI own a boutique interiors store in Melbourne and would love to explore stocking your products.\n\nCould you share your wholesale details?\n\nWarm regards,\nIsabella",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Isabella"
  }'
echo -e "\n"

# Email 8: Praise
echo "8. PRAISE TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "claire@example.com",
    "subject": "Absolutely love my order",
    "body_plain": "Hi,\n\nJust wanted to say how beautiful the piece is — it looks incredible in my space.\n\nThank you for such a thoughtful product.\n\nBest,\nClaire",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Claire"
  }'
echo -e "\n"

# Email 9: Spam
echo "9. SPAM TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "tom@spam.com",
    "subject": "Increase your sales by 300%",
    "body_plain": "Hi,\n\nWe help ecommerce brands scale to 7 figures in 90 days.\n\nLet'\''s book a quick call this week.\n\nBest,\nTom",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Tom"
  }'
echo -e "\n"

# Email 10: Ambiguous
echo "10. AMBIGUOUS TEST"
curl -s -X POST https://sagitine-hud.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "unknown@example.com",
    "subject": "Quick question",
    "body_plain": "Hi,\n\nI received something but I'\''m not sure if it'\''s correct.\n\nCan you help?",
    "timestamp": "2026-04-02T12:00:00.000Z",
    "from_name": "Unknown"
  }'
echo -e "\n"
