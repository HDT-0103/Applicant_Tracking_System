# Integration Test Utilities

This folder contains standalone scripts used to verify the ATS AI pipeline from document parsing through database persistence.

## Project Structure

- `01_seed_users.py`: inserts sample users and prints the inserted UUIDs.
- `02_import_resumes.py`: scans every PDF in `sample_resumes/`, parses each file, runs LLM analysis, generates embeddings, and persists resume records.
- `03_build_requirement.py`: creates one requirement, runs analysis, creates embeddings, and persists them.
- `04_run_search.py`: loads the latest requirement embedding, loads resume embeddings, runs ranking, and prints scores in descending order.
- `05_verify_database.py`: prints table counts and checks foreign-key integrity across the persisted records.
- `06_generate_fake_data.py`: generates fake recruiters, candidates, and requirements using Faker.
- `07_common.py`: shared configuration, logging, async database session factory, and path helpers.

## Execution Order

1. Seed users.
2. Import resumes.
3. Build a requirement.
4. Run search.
5. Verify the database.
6. Optionally generate fake data for bulk testing.

## Expected Output

- `01_seed_users.py`: a list of inserted UUIDs.
- `02_import_resumes.py`: progress messages and one inserted Resume ID per PDF.
- `03_build_requirement.py`: one Requirement ID.
- `04_run_search.py`: ranked results with skill, experience, summary, and final scores.
- `05_verify_database.py`: row counts and foreign-key checks.
- `06_generate_fake_data.py`: generated user and requirement IDs.

## Example Commands

Run each script from the project root:

```bash
python tests/01_seed_users.py
python tests/02_import_resumes.py
python tests/03_build_requirement.py
python tests/04_run_search.py
python tests/05_verify_database.py
python tests/06_generate_fake_data.py
```

## Troubleshooting

- If the database connection fails, check `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME`.
- If PDF import fails, confirm `sample_resumes/` exists and contains valid PDF files.
- If the LLM step fails, verify `GROQ_API_KEY` is set.
- If embedding fails or is slow, confirm the `sentence-transformers` model can be downloaded and the machine has enough memory.
- If ranking fails, ensure both resume embeddings and requirement embeddings already exist in the database.

## Database Verification

`05_verify_database.py` checks that every child row has a matching parent key for:

- `resumes.user_id -> users.id`
- `requirements.user_id -> users.id`
- `resume_analyses.resume_id -> resumes.id`
- `resume_embeddings.resume_id -> resumes.id`
- `requirement_analyses.requirement_id -> requirements.id`
- `requirement_embeddings.requirement_id -> requirements.id`
