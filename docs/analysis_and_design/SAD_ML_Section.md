ML Model Deployment and Operations

The Melon AI Learning App uses five pre-trained AI models accessed through third-party APIs: GPT-4o-mini for AI tutoring chat, Whisper-1 for speech-to-text, Gemini 2.0 Flash for multimodal answer evaluation and rubric classification, eleven_multilingual_v2 from ElevenLabs for text-to-speech, and GPT-4o-mini via OpenRouter for RAG-based quiz generation. None of these models are hosted on team infrastructure. All are consumed as managed cloud services with no local GPU, no stored model weights, and no inference runtime managed by the team.

When deployed, the Next.js application routes each AI feature through a dedicated internal API endpoint that validates input, runs a content moderation check where applicable, and forwards the request to the appropriate vendor API. The Python FastAPI backend separately handles PDF ingestion, chunking, ChromaDB vector storage, RAG retrieval, quiz generation, and TTS proxying. API keys are stored as server-side environment variables and never exposed to the client.


Static vs. Dynamic Deployment

All models are deployed statically. The model version for each service is fixed either as a hardcoded identifier in the source file or as an environment variable set before deployment. The system does not perform dynamic model selection, A/B routing, or automatic version switching at runtime. Any model version change requires a code or configuration update followed by a deliberate redeployment.


Retraining, Fine-Tuning, Revision, and Redeployment

The team does not perform model training or fine-tuning. All models are pre-trained and accessed via API. Instead of modifying model weights, the team improves model accuracy for each task by carefully designing system prompts, providing sufficient domain context, and iteratively revising both the prompt content and inference parameters such as temperature. For example, the rubric classifier is given a detailed Vietnamese-language prompt with explicit definitions and examples for each Bloom's level, the answer evaluator is provided with the question, expected answer, lesson context, and leniency instructions, and the quiz generator is given the retrieved document context alongside strict grounding rules. When a model underperforms on a specific task, the team identifies which part of the prompt or context is insufficient, revises it, and re-evaluates against the test set until the output meets the acceptance threshold. All prompt changes are committed to version control and treated as model revisions.

When a vendor releases a new model version, the team tests it in a staging environment, compares results against the defined thresholds, and updates the configuration if all thresholds are met. After each redeployment, the evaluation suite is re-run to confirm no regressions. If a regression is found, the previous configuration is restored.


Evaluation Datasets and Metrics

We evaluate three core AI components: the rubric classifier, the RAG-based MCQA quiz generator, and the OCR-based PDF problem parser.

The rubric classifier is evaluated on a subset of our own mathematics problem bank — approximately one hundred Vietnamese math questions from grades four and five, manually labeled by two team members across four Bloom's taxonomy levels and resolved by consensus. Classification accuracy must reach at least 75%, macro F1-score at least 0.70, and accuracy on high-confidence predictions (confidence ≥ 0.8) at least 85%. The low-confidence rate must not exceed 10% and the JSON parse failure rate must stay below 2%.

The RAG quiz generator outputs strictly in MCQA format: one correct answer and three distractors. It is evaluated on fifty questions generated from five of our own lesson PDFs, ten per document, each manually reviewed against the source. Answer accuracy and groundedness must each reach at least 90%. Distractor relatedness is assessed using a natural language inference approach: each distractor must be semantically in-domain and share the same entity type as the correct answer, but must not be entailed by the source passage as correct. The distractor relatedness acceptance rate must be at least 80%. JSON parse success must be at least 98% and question uniqueness at least 95%.

The PDF problem parser uses Gemini 2.5 Pro for OCR and GPT-4.1 for structured extraction via OpenRouter. Since both are pretrained, we report their published benchmarks as the baseline expectation: Gemini 2.5 Pro achieves approximately 94% on DocVQA and over 90% on OCRBench. The team additionally tested on thirty scanned Vietnamese math exam pages from our own uploaded problem sets. Field extraction accuracy — the percentage of question stems, choices, and answer keys extracted correctly — must reach at least 85%, and the question detection rate must reach at least 90%.
