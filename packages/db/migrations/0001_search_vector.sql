-- Weighted full-text search for works — CONTEXT.md section 11.1: "weighted: title A, authors B,
-- abstract C". A GENERATED ALWAYS AS column can't subquery another table, so `authorships` can't
-- feed it directly; `author_names_cached` (already in the initial migration, packages/db/src/
-- schema/works.ts) is kept in sync by the trigger below, and the generated column reads from it
-- like any other same-row text field. See docs/adr/0005-seed-fixture-provenance.md's sibling
-- comment in works.ts for the full reasoning.

CREATE OR REPLACE FUNCTION works_refresh_author_names_cached() RETURNS trigger AS $$
DECLARE
  affected_work_id uuid;
BEGIN
  affected_work_id := COALESCE(NEW.work_id, OLD.work_id);

  UPDATE works
  SET author_names_cached = (
    SELECT string_agg(raw_name, ' ' ORDER BY "position")
    FROM authorships
    WHERE work_id = affected_work_id
  )
  WHERE id = affected_work_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER authorships_refresh_work_author_names
AFTER INSERT OR UPDATE OR DELETE ON authorships
FOR EACH ROW EXECUTE FUNCTION works_refresh_author_names_cached();

-- Drop the plain column drizzle-kit generated and replace it with a real generated column.
ALTER TABLE "works" DROP COLUMN "search_vector";

ALTER TABLE "works" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("author_names_cached", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("abstract", '')), 'C')
) STORED;

CREATE INDEX "works_search_vector_idx" ON "works" USING GIN ("search_vector");

-- pg_trgm fuzzy title matching — CONTEXT.md section 11.1.
CREATE INDEX "works_title_trgm_idx" ON "works" USING GIN ("title" gin_trgm_ops);
