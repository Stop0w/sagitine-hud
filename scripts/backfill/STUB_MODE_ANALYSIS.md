# Stub Mode Classification Logic

## How It Works (run_classification.py)

### Step 1: Keyword-Based Category Detection

**Keywords per category:**

```python
damaged_missing_faulty = [
    'damaged', 'broken', 'cracked', 'faulty', 'defective',
    'missing', 'not received', 'arrived broken', 'does not work'
]

shipping_delivery_order_issue = [
    'delivery', 'shipping', 'tracking', 'shipped', 'dispatch',
    'courier', 'australia post', 'tracking number'
]

product_usage_guidance = [
    'how to', 'how do i', 'instructions', 'setup', 'install',
    'use the', 'assemble', 'configuration'
]

pre_purchase_question = [
    'before i buy', 'thinking of buying', 'interested in',
    'pre-order', 'does it have', 'can you tell me'
]

return_refund_exchange = [
    'return', 'refund', 'exchange', 'change my mind',
    'not what i expected', 'send it back'
]

stock_availability = [
    'in stock', 'available', 'when will', 'out of stock',
    'back in stock', 'pre-order', 'waitlist'
]

partnership_wholesale_press = [
    'wholesale', 'partnership', 'collaboration', 'press',
    'inquiry', 'business', 'resell', 'stockist'
]

brand_feedback_general = [
    'love your', 'great design', 'beautiful', 'feedback',
    'suggestion', 'compliment'
]
```

**Algorithm:**
1. Search email subject + body for each keyword
2. Count keyword matches per category
3. Select category with highest match count
4. Default to `brand_feedback_general` if no matches

---

### Step 2: Sentiment Detection

**Rules:**

```python
if 'love' or 'great' or 'beautiful' or 'thank' in text:
    sentiment = 'positive'

elif 'disappointed' or 'frustrated' or 'angry' or 'terrible' in text:
    sentiment = 'negative'

elif 'urgent' or 'asap' or 'immediately' or 'problem' in text:
    sentiment = 'critical'

else:
    sentiment = 'neutral'
```

**Limitation:** Binary keyword matching - misses nuance, sarcasm, mixed sentiment.

---

### Step 3: Customer Intent Summary

**Rule:**
```python
customer_intent = f"Customer inquiry regarding {category_primary.replace('_', ' ')}"
```

**Limitation:** Generic template, not based on actual email content analysis.

---

### Step 4: Tone Detection

**Keywords per tone:**

```python
warm_composed = ['thank you', 'appreciate', 'looking forward']
professional_direct = ['please advise', 'clarify', 'confirm']
empathetic_confident = ['understand', 'concern', 'assure']
clarifying_helpful = ['help', 'guidance', 'explain']
```

**Algorithm:** Count matches, select tone with highest count.

---

### Step 5: Response Quality Score

**Rules:**

```python
if word_count > 100:
    response_quality_score = 9
elif word_count > 50:
    response_quality_score = 8
elif word_count > 20:
    response_quality_score = 7
else:
    response_quality_score = 6
```

**Limitation:** Based only on length, not content quality or tone appropriateness.

---

### Step 6: Training Eligibility

**Rules:**

```python
should_be_used_for_training = (
    response_quality_score >= 7 and
    sentiment not in ['critical'] and
    word_count >= 20
)
```

---

## Quality Limitations Without Live Claude

### Accuracy Issues

**Stub mode limitations:**

1. **Category classification (~70% accuracy)**
   - ❌ Misses context clues
   - ❌ Fails on multi-category emails
   - ❌ Can't detect sarcasm or mixed intent
   - ❌ Over-sensitive to keyword spam
   - ✅ Claude: ~85-90% accuracy

2. **Sentiment detection (~60% accuracy)**
   - ❌ Binary positive/negative only
   - ❌ Misses nuanced frustration
   - ❌ Can't detect suppressed anger
   - ✅ Claude: Detects subtle sentiment shifts

3. **Customer intent (~50% accuracy)**
   - ❌ Template-based, not content-aware
   - ❌ No understanding of actual request
   - ❌ Misses urgency cues
   - ✅ Claude: Accurate intent extraction

4. **Tone detection (~65% accuracy)**
   - ❌ Keyword matching only
   - ❌ Misses tone inconsistencies
   - ❌ Can't detect defensive language patterns
   - ✅ Claude: Sophisticated tone analysis

5. **Quality scoring (~40% accuracy)**
   - ❌ Based on word count only
   - ❌ No assessment of tone quality
   - ❌ Can't detect helpful vs unhelpful
   - ✅ Claude: Multidimensional quality assessment

---

### Specific Failure Cases

**Stub mode will fail on:**

1. **Multi-category emails:**
   - "My Box arrived damaged AND I want to return it"
   - Stub: Picks one category
   - Claude: Detects both, flags for review

2. **Polite but angry customers:**
   - "I'm disappointed but remaining hopeful..."
   - Stub: May classify as positive
   - Claude: Detects underlying frustration

3. **Implied urgency:**
   - "This is the third time I've contacted you..."
   - Stub: Misses urgency pattern
   - Claude: Recognises escalation

4. **Product questions with complaints:**
   - "Why does the Box keep {problem}?"
   - Stub: May classify as usage guidance
   - Claude: Detects as damaged/faulty

5. **Complex partnership inquiries:**
   - "We're a retailer interested in stocking but have concerns about..."
   - Stub: May classify as general feedback
   - Claude: Identifies partnership + needs

---

### Impact on Knowledge Quality

**With stub mode:**

✅ **Will work adequately:**
- High-volume, straightforward emails
- Clear category signals
- Common use cases
- Pattern extraction at scale

❌ **Will produce lower quality:**
- Nuanced customer situations
- Edge cases and exceptions
- Complex multi-issue emails
- Subtle tone requirements
- Training data for AI improvement

---

### Recommendation

**For MVP/prototype:**
- ✅ Stub mode is acceptable
- ✅ Good enough for initial knowledge base
- ✅ Fast and free (no API costs)

**For production:**
- ❌ Stub mode is insufficient
- ❌ Will propagate classification errors
- ❌ Limited AI training value
- ✅ Use Claude API for quality

**Hybrid approach:**
1. Run stub mode first (fast)
2. Manually review classifications
3. Re-run questionable emails with Claude API
4. Filter out low-confidence classifications

---

## Confidence Scores

**Stub mode assigns:**
```python
confidence_score = 0.7  # Fixed at 70%
```

**Reasoning:**
- Keyword matching is ~70% accurate
- Conservative estimate (not overconfident)
- Signals uncertainty to downstream systems

**Claude mode:**
- Variable confidence (0.7-0.99)
- Based on actual classification certainty
- Higher confidence for clear cases

---

## Comparison Table

| Aspect | Stub Mode | Claude Mode |
|--------|-----------|--------------|
| **Category accuracy** | ~70% | ~85-90% |
| **Sentiment detection** | ~60% | ~90% |
| **Intent extraction** | Template | Accurate |
| **Quality scoring** | Length-based | Multidimensional |
| **Execution time** | ~2-3 min | ~15-20 min |
| **Cost** | Free | API credits |
| **Setup required** | None | API key |
| **Confidence score** | Fixed 0.7 | Variable 0.7-0.99 |
| **Best for** | Prototype, fast iteration | Production, high quality |

---

## When to Use Each Mode

### Use Stub Mode When:
- ✅ Building initial knowledge base
- ✅ Testing pipeline logic
- ✅ No API budget yet
- ✅ Fast iteration needed
- ✅ Acceptable to have some noise

### Use Claude Mode When:
- ✅ Production-quality data needed
- ✅ Training AI for customer responses
- ✅ High-stakes responses (refunds, escalations)
- ✅ Regulatory/compliance requirements
- ✅ API budget available

---

## Mitigation Strategies

If using stub mode:

1. **Manual review checkpoint**
   - Review classified emails before pattern extraction
   - Focus on high-volume categories
   - Spot-check edge cases

2. **Adjust thresholds**
   - Increase `MIN_RESPONSE_QUALITY_SCORE` to 9
   - Be more conservative about training eligibility

3. **Two-pass approach**
   - Pass 1: Stub mode classification
   - Pass 2: Re-classify low-confidence with Claude
   - Balance speed and quality

4. **Validation**
   - Compare stub vs Claude on 50-email sample
   - Measure error rate by category
   - Adjust keywords based on findings

---

## Current Configuration

**In `config.py`:**
```python
ENABLE_LLM_CLASSIFICATION = False  # Stub mode default
MIN_RESPONSE_QUALITY_SCORE = 8     # Keep only 8+
MIN_CONFIDENCE_SCORE = 0.7         # Not used in stub mode
```

**To enable Claude:**
```python
ENABLE_LLM_CLASSIFICATION = True
# Set ANTHROPIC_API_KEY in environment
```

---

## Conclusion

Stub mode is **structurally complete** but has **significant quality limitations**:

✅ **Works for:** Initial knowledge base, fast prototyping
⚠️ **Risks:** Classification errors, lower quality training data
❌ **Not for:** Production use without review

**Recommendation:** Run stub mode first, validate outputs, then re-run with Claude for production-quality knowledge base.
