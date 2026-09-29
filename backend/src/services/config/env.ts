// AI (RAG)
AI_PROVIDER: z.enum(['openai', 'yandex', 'gigachat', 'none']).default('none'),
OPENAI_API_KEY: z.string().optional(),
YANDEX_API_KEY: z.string().optional(),
YANDEX_FOLDER_ID: z.string().optional(),
GIGACHAT_KEY: z.string().optional(),