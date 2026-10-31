-- Preserve existing data, align new accounts with the P2 rubric.
ALTER TABLE "MemberShip" ALTER COLUMN "score" SET DEFAULT 10;
INSERT INTO "Role" (rolename) VALUES ('normal') ON CONFLICT (rolename) DO NOTHING;
UPDATE "User" SET roleid = (SELECT roleid FROM "Role" WHERE rolename='normal')
WHERE roleid IN (SELECT roleid FROM "Role" WHERE rolename='CUSTOMER');
UPDATE "MemberShip" SET score=10 WHERE mname='Standard' AND score=0;
