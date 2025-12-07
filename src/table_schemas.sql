CREATE TABLE IF NOT EXISTS public.ai_evaluation_results
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    question_id integer,
    evaluator_version text COLLATE pg_catalog."default",
    evaluator_raw_response text COLLATE pg_catalog."default",
    evaluator_parsed_response jsonb,
    evaluator_score double precision,
    evaluated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    evaluator_tracker text COLLATE pg_catalog."default",
    CONSTRAINT ai_evaluation_results_pkey PRIMARY KEY (id),
    CONSTRAINT ai_evaluation_results_question_id_fkey FOREIGN KEY (question_id)
        REFERENCES public.generated_questions (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.ai_evaluation_results
    OWNER to postgres;





CREATE TABLE IF NOT EXISTS public.generated_questions
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    recipe_id integer,
    model text COLLATE pg_catalog."default",
    inference_params jsonb,
    prompt_text text COLLATE pg_catalog."default",
    model_raw_response text COLLATE pg_catalog."default",
    model_parsed_response jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    question_type text COLLATE pg_catalog."default",
    experiment_tracker text COLLATE pg_catalog."default",
    embedding vector(768),
    embedding_model text COLLATE pg_catalog."default",
    CONSTRAINT generated_questions_pkey PRIMARY KEY (id),
    CONSTRAINT generated_questions_recipe_id_fkey FOREIGN KEY (recipe_id)
        REFERENCES public.question_recipes (recipe_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.generated_questions
    OWNER to postgres;
-- Index: generated_questions_experiment_tracker_idx

-- DROP INDEX IF EXISTS public.generated_questions_experiment_tracker_idx;

CREATE INDEX IF NOT EXISTS generated_questions_experiment_tracker_idx
    ON public.generated_questions USING btree
    (experiment_tracker COLLATE pg_catalog."default" ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;
-- Index: generated_questions_model_idx

-- DROP INDEX IF EXISTS public.generated_questions_model_idx;

CREATE INDEX IF NOT EXISTS generated_questions_model_idx
    ON public.generated_questions USING btree
    (model COLLATE pg_catalog."default" ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;
-- Index: idx_generated_questions_embedding

-- DROP INDEX IF EXISTS public.idx_generated_questions_embedding;

CREATE INDEX IF NOT EXISTS idx_generated_questions_embedding
    ON public.generated_questions USING ivfflat
    (embedding)
    WITH (lists=1000)
    TABLESPACE pg_default;
-- Index: idx_model_experiment

-- DROP INDEX IF EXISTS public.idx_model_experiment;

CREATE INDEX IF NOT EXISTS idx_model_experiment
    ON public.generated_questions USING btree
    (model COLLATE pg_catalog."default" ASC NULLS LAST, experiment_tracker COLLATE pg_catalog."default" ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;


-- Table: public.question_recipes

-- DROP TABLE IF EXISTS public.question_recipes;

CREATE TABLE IF NOT EXISTS public.question_recipes
(
    recipe_id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    source_sheet text COLLATE pg_catalog."default",
    grade_level text COLLATE pg_catalog."default",
    subject text COLLATE pg_catalog."default",
    domain text COLLATE pg_catalog."default",
    cluster text COLLATE pg_catalog."default",
    standard_id_l1 text COLLATE pg_catalog."default",
    standard_desc_l1 text COLLATE pg_catalog."default",
    standard_id_l2 text COLLATE pg_catalog."default",
    standard_desc_l2 text COLLATE pg_catalog."default",
    substandard_id text COLLATE pg_catalog."default",
    lesson_title text COLLATE pg_catalog."default",
    question_type text[] COLLATE pg_catalog."default",
    tasks text COLLATE pg_catalog."default",
    difficulty text COLLATE pg_catalog."default",
    constraints text COLLATE pg_catalog."default",
    direct_instruction text COLLATE pg_catalog."default",
    step_by_step_explanation text COLLATE pg_catalog."default",
    misconception_1 text COLLATE pg_catalog."default",
    misconception_2 text COLLATE pg_catalog."default",
    misconception_3 text COLLATE pg_catalog."default",
    misconception_4 text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT question_recipes_pkey PRIMARY KEY (recipe_id),
    CONSTRAINT unique_lesson UNIQUE (source_sheet, substandard_id, lesson_title)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.question_recipes
    OWNER to postgres;