# SAMPLE OUTPUTS (Preview)

These are EXAMPLES of what the pipeline will generate once executed.

---

## Gold Response Samples (5 examples)

### 1. Damaged/Missing/Faulty

```json
{
  "id": "damaged_missing_faulty_template",
  "title": "Damaged/Missing/Faulty Response Template",
  "category": "damaged_missing_faulty",
  "body_template": "# Opening\nThank you for reaching out to us about your Box.\n\n# Structure\n- Average length: medium (150-200 words)\n- Paragraphs: 3-4\n\n# Tone Guidelines\nWarmth: 75% | Composure: 82% | Defensive: <5%\n\n# Approach\n1. Acknowledge the issue directly\n2. Express understanding without over-apologising\n3. Provide clear solution or next step\n4. Confirm timeline\n5. Close professionally",
  "tone_notes": "Direct and confident; Focus on solutions not apologies; Use 'thank you' not 'sorry'; Compose language throughout",
  "avg_word_count": 165,
  "avg_paragraph_count": 3,
  "sample_count": 127,
  "created_from_patterns": true,
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 2. Shipping/Delivery

```json
{
  "id": "shipping_delivery_order_issue_template",
  "title": "Shipping/Delivery Response Template",
  "category": "shipping_delivery_order_issue",
  "body_template": "# Opening\nThank you for your enquiry regarding your delivery status.\n\n# Structure\n- Average length: medium (120-180 words)\n- Paragraphs: 2-3\n\n# Tone Guidelines\nWarmth: 68% | Composure: 79% | Defensive: <3%\n\n# Approach\n1. Provide tracking information if available\n2. Explain current delivery status clearly\n3. Set realistic expectations for timeline\n4. Offer proactive follow-up if needed\n5. Close with assurance\n\n# What to Avoid\n- Don't make promises you can't keep\n- Don't blame courier partners\n- Don't over-explain logistics",
  "tone_notes": "Helpful and informative; Stay calm even with delays; Provide concrete next steps; Avoid logistics jargon",
  "avg_word_count": 142,
  "avg_paragraph_count": 3,
  "sample_count": 198,
  "created_from_patterns": true,
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 3. Product Usage Guidance

```json
{
  "id": "product_usage_guidance_template",
  "title": "Product Usage Guidance Response Template",
  "category": "product_usage_guidance",
  "body_template": "# Opening\nThank you for your question about using your Sagitine Box.\n\n# Structure\n- Average length: longer (180-250 words)\n- Paragraphs: 4-5\n\n# Tone Guidelines\nWarmth: 71% | Composure: 76% | Defensive: <2%\n\n# Approach\n1. Acknowledge the specific feature or setup question\n2. Provide clear step-by-step guidance\n3. Offer additional resources if helpful\n4. Invite follow-up questions\n5. Close warmly\n\n# What to Avoid\n- Don't be condescending\n- Don't assume technical knowledge level\n- Don't overwhelm with too much detail at once",
  "tone_notes": "Educational and patient; Break down complex steps; Use clear language; Encourage questions",
  "avg_word_count": 215,
  "avg_paragraph_count": 4,
  "sample_count": 156,
  "created_from_patterns": true,
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 4. Return/Refund/Exchange

```json
{
  "id": "return_refund_exchange_template",
  "title": "Return/Refund/Exchange Response Template",
  "category": "return_refund_exchange",
  "body_template": "# Opening\nThank you for reaching out about your return request.\n\n# Structure\n- Average length: medium (140-190 words)\n- Paragraphs: 3-4\n\n# Tone Guidelines\nWarmth: 64% | Composure: 85% | Defensive: <8%\n\n# Approach\n1. Acknowledge the return request clearly\n2. Confirm understanding of reason\n3. Explain the return process steps\n4. Provide timeline for refund/exchange\n5. Set expectations for next steps\n\n# What to Avoid\n- Don't question their decision\n- Don't make them feel guilty\n- Don't over-apologise for policy",
  "tone_notes": "Professional and accommodating; Clear process steps; Confident policy communication; Avoid defensive language",
  "avg_word_count": 158,
  "avg_paragraph_count": 3,
  "sample_count": 89,
  "created_from_patterns": true,
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 5. Brand Feedback/General

```json
{
  "id": "brand_feedback_general_template",
  "title": "Brand Feedback/General Response Template",
  "category": "brand_feedback_general",
  "body_template": "# Opening\nThank you so much for taking the time to share your feedback with us.\n\n# Structure\n- Average length: short-medium (80-140 words)\n- Paragraphs: 2-3\n\n# Tone Guidelines\nWarmth: 82% | Composure: 70% | Defensive: <1%\n\n# Approach\n1. Express genuine appreciation\n2. Acknowledge specific feedback if provided\n3. Reinforce brand values positively\n4. Invite continued engagement\n5. Close warmly\n\n# What to Avoid\n- Don't be effusive or over-the-top\n- Don't make promises you can't keep\n- Don't use generic responses",
  "tone_notes": "Warm and appreciative; Personal when possible; Reinforce brand connection; Keep authentic",
  "avg_word_count": 98,
  "avg_paragraph_count": 2,
  "sample_count": 67,
  "created_from_patterns": true,
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

## Knowledge Snippet Samples (10 examples)

### 1. Tone Policy (Damaged/Missing/Faulty)

```json
{
  "id": "damaged_missing_faulty_tone_policy",
  "type": "policy",
  "category": "damaged_missing_faulty",
  "content": "Tone Guidelines for Damaged/Missing/Faulty:\n\n- Warmth: 75% (target: >60%)\n- Composure: 82% (target: >70%)\n- Defensive language: <5% (target: <10%)\n\nKey approach:\n- Acknowledge the issue directly\n- Focus on solutions not apologies\n- Use 'thank you for reaching out' instead of 'sorry'\n- Be confident in resolution: 'We will organise a replacement'\n- Provide clear timeline\n- Avoid defensive language like 'unfortunately'",
  "tags": ["damaged_missing_faulty", "tone", "policy"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 2. Terminology Policy (Box vs Drawer)

```json
{
  "id": "brand_terminology_policy",
  "type": "policy",
  "category": "brand_feedback_general",
  "content": "Product Terminology - CRITICAL:\n\nALWAYS use: 'Box'\nNEVER use: 'drawer'\n\nThis is non-negotiable brand terminology. Sagitine products are premium storage Boxes, never drawers.\n\nUsage across all categories:\n- Damaged/Missing/Faulty: 'Your Box'\n- Product Usage: 'the Box'\n- Returns: 'returning the Box'\n- Stock: 'Box availability'\n\nEnforcement:\n- All templates must use 'Box'\n- Train AI on 'Box' terminology\n- Review responses for compliance",
  "tags": ["brand_feedback_general", "terminology", "policy", "critical"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 3. Avoidance Guidance (Over-Apologising)

```json
{
  "id": "tone_avoidance_over_apologetic",
  "type": "guidance",
  "category": "brand_feedback_general",
  "content": "What to Avoid: Over-Apologising Language\n\nPROBLEMATIC PHRASES (found in historical responses):\n- 'sorry for the inconvenience'\n- 'we apologise for'\n- 'regret to inform'\n- 'unfortunately we'\n\nBETTER ALTERNATIVES:\n- 'Thank you for reaching out'\n- 'We appreciate you letting us know'\n- 'We understand the situation'\n- 'Let us help resolve this'\n\nRemember:\n- Sagitine tone is confident, not defensive\n- Focus on solutions not problems\n- Use 'thank you' instead of 'sorry'\n- Be direct and composed",
  "tags": ["brand_feedback_general", "tone", "avoidance", "guidance"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 4. Pattern Fact (Shipping Response Structure)

```json
{
  "id": "shipping_delivery_response_patterns",
  "type": "fact",
  "category": "shipping_delivery_order_issue",
  "content": "Response Patterns for Shipping/Delivery:\n\n- Typical word count: 142 words\n- Average paragraphs: 3\n- Response length: medium\n\nCommon structure:\n1. Acknowledge delivery status enquiry\n2. Provide current tracking/ETA information\n3. Explain any delays clearly\n4. Set realistic expectations\n5. Offer proactive follow-up\n\nTone markers:\n- 68% warm language (thank you, appreciate)\n- 79% composed language (certainly, confirm, clarify)\n- <3% defensive language (low for this category)",
  "tags": ["shipping_delivery_order_issue", "patterns", "fact", "structure"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 5. Policy (Return Process Communication)

```json
{
  "id": "return_refund_process_policy",
  "type": "policy",
  "category": "return_refund_exchange",
  "content": "Return Process Communication Policy:\n\nWhen handling returns:\n1. Acknowledge request directly (don't question their decision)\n2. Confirm understanding of reason\n3. Explain return process clearly:\n   - Return authorization steps\n   - Shipping instructions\n   - Refund timeline (typically 5-10 business days)\n   - Exchange options if applicable\n4. Set expectations for confirmation\n5. Provide contact details for questions\n\nTone rules:\n- Professional and accommodating\n- Clear process communication\n- Confident policy explanation\n- No defensive language about policy",
  "tags": ["return_refund_exchange", "process", "policy"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 6. Guidance (Product Education Approach)

```json
{
  "id": "product_usage_education_guidance",
  "type": "guidance",
  "category": "product_usage_guidance",
  "content": "Product Usage - Educational Approach:\n\nWhen helping customers use their Box:\n\nDO:\n- Break down complex steps into simple actions\n- Use clear, non-technical language\n- Provide context for why steps matter\n- Offer additional resources: 'Would you like a video guide?'\n- Invite follow-up: 'What else can I help with?'\n\nDON'T:\n- Be condescending or talk down\n- Assume technical knowledge level\n- Overwhelm with too much detail at once\n- Use jargon without explanation\n- Make them feel foolish for asking\n\nRemember:\n- Every question is valid\n- Your role is to be helpful, not impressive\n- Clear instructions build confidence",
  "tags": ["product_usage_guidance", "education", "guidance", "tone"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 7. Fact (Pre-Purchase Question Patterns)

```json
{
  "id": "pre_purchase_question_patterns",
  "type": "fact",
  "category": "pre_purchase_question",
  "content": "Pre-Purchase Question Patterns:\n\n- Typical word count: 95 words\n- Average paragraphs: 2\n- Response length: short-medium\n\nCommon customer questions:\n- Product dimensions and sizing\n- Material quality and durability\n- Assembly requirements\n- Delivery timelines\n- Payment options\n- Comparison with other products\n\nResponse approach:\n1. Answer question directly\n2. Provide relevant product details\n3. Connect features to benefits\n4. Invite follow-up questions\n5. Close with purchasing encouragement\n\nTone: Warm but informative, not salesy",
  "tags": ["pre_purchase_question", "patterns", "fact", "customer_behavior"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 8. Policy (Stock Availability Communication)

```json
{
  "id": "stock_availability_communication_policy",
  "type": "policy",
  "category": "stock_availability",
  "content": "Stock Availability Communication Policy:\n\nWhen customers ask about stock:\n\nIN STOCK:\n1. Confirm availability immediately\n2. Provide expected shipping timeline\n3. Offer to reserve if needed\n4. Encourage purchase decision\n\nOUT OF STOCK:\n1. Be transparent about status\n2. Provide realistic restock timeline if known\n3. Offer waitlist option: 'We can notify you when it's back'\n4. Suggest alternatives if available\n5. Maintain confidence (don't apologise for inventory)\n\nPRE-ORDER:\n1. Explain pre-order timeline clearly\n2. Set realistic expectations\n3. Confirm charge timing\n4. Provide regular update commitment\n\nTone: Honest and transparent, confident about inventory management",
  "tags": ["stock_availability", "inventory", "policy", "communication"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 9. Guidance (Partnership Inquiry Response)

```json
{
  "id": "partnership_wholesale_inquiry_guidance",
  "type": "guidance",
  "category": "partnership_wholesale_press",
  "content": "Partnership/Wholesale/Press Inquiry Guidance:\n\nReceiving partnership inquiries:\n\nDO:\n1. Acknowledge interest warmly\n2. Clarify inquiry type (partnership/wholesale/press)\n3. Gather relevant details:\n   - Company/background\n   - Proposed collaboration type\n   - Timeline expectations\n4. Set appropriate response expectations\n5. Route to correct internal contact\n\nDON'T:\n1. Make commitments without authority\n2. Promise partnership terms\n3. Provide internal confidential information\n4. Be vague about next steps\n\nResponse structure:\n- Thank you for interest\n- I'd be happy to connect you with\n- Our [relevant team] will follow up\n- What's the best way to reach you?\n\nTone: Professional and interested, but not over-committal",
  "tags": ["partnership_wholesale_press", "business", "guidance", "protocol"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

### 10. Fact (Brand Feedback Response Metrics)

```json
{
  "id": "brand_feedback_response_metrics",
  "type": "fact",
  "category": "brand_feedback_general",
  "content": "Brand Feedback/General Response Metrics:\n\n- Typical word count: 98 words\n- Average paragraphs: 2\n- Response length: short\n- Warmth score: 82% (highest of all categories)\n- Composure score: 70%\n- Defensive language: <1%\n\nCharacteristics:\n- Appreciative and genuine\n- Personal when possible\n- Reinforce brand values positively\n- Invite continued engagement\n- Keep authentic, not generic\n\nCustomer intent:\n- Sharing positive experiences\n- Suggesting improvements\n- Asking product questions\n- Complimenting design/quality\n\nResponse goal: Strengthen brand connection through authentic engagement",
  "tags": ["brand_feedback_general", "metrics", "fact", "tone_analysis"],
  "created_at": "2026-03-31T14:30:00Z",
  "exported_at": "2026-03-31T15:00:00Z",
  "ready_for_db": true
}
```

---

## NOTES

These are **STRUCTURED EXAMPLES** based on:
- Sagitine tone rules from briefs
- Category definitions from MASTER_BRIEF.md
- Expected patterns from email types
- Knowledge base best practices

**ACTUAL outputs will vary based on:**
- Real email content in raw_data/
- Classification results (stub or LLM)
- Pattern extraction from actual data
- Filtering results

To generate REAL outputs, run: `python run_all.py`
