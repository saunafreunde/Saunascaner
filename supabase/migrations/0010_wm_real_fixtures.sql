-- Migration 0010: Echter WM-2026-Spielplan
-- Zeiten in MESZ (UTC+2) — werden als TIMESTAMPTZ gespeichert.
-- Ersetzt die Platzhalter aus 0009 durch die echten 48 Teams und 104 Spiele.

-- ─── Reset Placeholder-Daten ─────────────────────────────────────────────
TRUNCATE TABLE wm_tips RESTART IDENTITY CASCADE;
TRUNCATE TABLE wm_meta_tips RESTART IDENTITY CASCADE;
DELETE FROM wm_matches;
DELETE FROM wm_teams;

-- ─── Echte 48 Teams (FIFA-Auslosung WM 2026) ─────────────────────────────
INSERT INTO wm_teams (code, name, flag, group_label) VALUES
  -- Gruppe A
  ('MEX','Mexiko','🇲🇽','A'),('RSA','Südafrika','🇿🇦','A'),('KOR','Südkorea','🇰🇷','A'),('CZE','Tschechien','🇨🇿','A'),
  -- Gruppe B
  ('CAN','Kanada','🇨🇦','B'),('BIH','Bosnien & Herzegowina','🇧🇦','B'),('QAT','Katar','🇶🇦','B'),('SUI','Schweiz','🇨🇭','B'),
  -- Gruppe C
  ('BRA','Brasilien','🇧🇷','C'),('MAR','Marokko','🇲🇦','C'),('HAI','Haiti','🇭🇹','C'),('SCO','Schottland','🏴','C'),
  -- Gruppe D
  ('USA','USA','🇺🇸','D'),('PAR','Paraguay','🇵🇾','D'),('AUS','Australien','🇦🇺','D'),('TUR','Türkei','🇹🇷','D'),
  -- Gruppe E
  ('GER','Deutschland','🇩🇪','E'),('CUW','Curaçao','🇨🇼','E'),('CIV','Elfenbeinküste','🇨🇮','E'),('ECU','Ecuador','🇪🇨','E'),
  -- Gruppe F
  ('NED','Niederlande','🇳🇱','F'),('JPN','Japan','🇯🇵','F'),('SWE','Schweden','🇸🇪','F'),('TUN','Tunesien','🇹🇳','F'),
  -- Gruppe G
  ('BEL','Belgien','🇧🇪','G'),('EGY','Ägypten','🇪🇬','G'),('IRN','Iran','🇮🇷','G'),('NZL','Neuseeland','🇳🇿','G'),
  -- Gruppe H
  ('ESP','Spanien','🇪🇸','H'),('CPV','Kap Verde','🇨🇻','H'),('KSA','Saudi-Arabien','🇸🇦','H'),('URU','Uruguay','🇺🇾','H'),
  -- Gruppe I
  ('FRA','Frankreich','🇫🇷','I'),('SEN','Senegal','🇸🇳','I'),('IRQ','Irak','🇮🇶','I'),('NOR','Norwegen','🇳🇴','I'),
  -- Gruppe J
  ('ARG','Argentinien','🇦🇷','J'),('ALG','Algerien','🇩🇿','J'),('AUT','Österreich','🇦🇹','J'),('JOR','Jordanien','🇯🇴','J'),
  -- Gruppe K
  ('POR','Portugal','🇵🇹','K'),('COD','DR Kongo','🇨🇩','K'),('UZB','Usbekistan','🇺🇿','K'),('COL','Kolumbien','🇨🇴','K'),
  -- Gruppe L
  ('ENG','England','🇬🇧','L'),('CRO','Kroatien','🇭🇷','L'),('GHA','Ghana','🇬🇭','L'),('PAN','Panama','🇵🇦','L');

-- ─── Helper: Spiel anlegen ───────────────────────────────────────────────
-- Wir verwenden CTEs mit Team-Code-Lookups für Lesbarkeit
WITH t AS (SELECT code, id FROM wm_teams)
INSERT INTO wm_matches (match_no, phase, group_label, kickoff, home_team_id, away_team_id, home_label, away_label)
SELECT v.match_no, v.phase, v.group_label, v.kickoff::timestamptz,
       (SELECT id FROM t WHERE t.code = v.home_code),
       (SELECT id FROM t WHERE t.code = v.away_code),
       v.home_label, v.away_label
FROM (VALUES
  -- ═══ VORRUNDE (1-72) ═══
  (1,'group','A','2026-06-11 21:00+02','MEX','RSA',NULL,NULL),
  (2,'group','A','2026-06-12 04:00+02','KOR','CZE',NULL,NULL),
  (3,'group','B','2026-06-12 21:00+02','CAN','BIH',NULL,NULL),
  (4,'group','D','2026-06-13 03:00+02','USA','PAR',NULL,NULL),
  (5,'group','B','2026-06-13 21:00+02','QAT','SUI',NULL,NULL),
  (6,'group','C','2026-06-14 00:00+02','BRA','MAR',NULL,NULL),
  (7,'group','C','2026-06-14 03:00+02','HAI','SCO',NULL,NULL),
  (8,'group','D','2026-06-14 06:00+02','AUS','TUR',NULL,NULL),
  (9,'group','E','2026-06-14 19:00+02','GER','CUW',NULL,NULL),
  (10,'group','F','2026-06-14 22:00+02','NED','JPN',NULL,NULL),
  (11,'group','E','2026-06-15 01:00+02','CIV','ECU',NULL,NULL),
  (12,'group','F','2026-06-15 04:00+02','SWE','TUN',NULL,NULL),
  (13,'group','H','2026-06-15 18:00+02','ESP','CPV',NULL,NULL),
  (14,'group','G','2026-06-15 21:00+02','BEL','EGY',NULL,NULL),
  (15,'group','H','2026-06-16 00:00+02','KSA','URU',NULL,NULL),
  (16,'group','G','2026-06-16 03:00+02','IRN','NZL',NULL,NULL),
  (17,'group','I','2026-06-16 21:00+02','FRA','SEN',NULL,NULL),
  (18,'group','I','2026-06-17 00:00+02','IRQ','NOR',NULL,NULL),
  (19,'group','J','2026-06-17 03:00+02','ARG','ALG',NULL,NULL),
  (20,'group','J','2026-06-17 06:00+02','AUT','JOR',NULL,NULL),
  (21,'group','K','2026-06-17 19:00+02','POR','COD',NULL,NULL),
  (22,'group','L','2026-06-17 22:00+02','ENG','CRO',NULL,NULL),
  (23,'group','L','2026-06-18 01:00+02','GHA','PAN',NULL,NULL),
  (24,'group','K','2026-06-18 04:00+02','UZB','COL',NULL,NULL),
  (25,'group','A','2026-06-18 18:00+02','CZE','RSA',NULL,NULL),
  (26,'group','B','2026-06-18 21:00+02','SUI','BIH',NULL,NULL),
  (27,'group','B','2026-06-19 00:00+02','CAN','QAT',NULL,NULL),
  (28,'group','A','2026-06-19 03:00+02','MEX','KOR',NULL,NULL),
  (29,'group','D','2026-06-19 21:00+02','USA','AUS',NULL,NULL),
  (30,'group','C','2026-06-20 00:00+02','SCO','MAR',NULL,NULL),
  (31,'group','C','2026-06-20 02:30+02','BRA','HAI',NULL,NULL),
  (32,'group','D','2026-06-20 05:00+02','TUR','PAR',NULL,NULL),
  (33,'group','F','2026-06-20 19:00+02','NED','SWE',NULL,NULL),
  (34,'group','E','2026-06-20 22:00+02','GER','CIV',NULL,NULL),
  (35,'group','E','2026-06-21 02:00+02','ECU','CUW',NULL,NULL),
  (36,'group','F','2026-06-21 06:00+02','TUN','JPN',NULL,NULL),
  (37,'group','H','2026-06-21 18:00+02','ESP','KSA',NULL,NULL),
  (38,'group','G','2026-06-21 21:00+02','BEL','IRN',NULL,NULL),
  (39,'group','H','2026-06-22 00:00+02','URU','CPV',NULL,NULL),
  (40,'group','G','2026-06-22 03:00+02','NZL','EGY',NULL,NULL),
  (41,'group','J','2026-06-22 19:00+02','ARG','AUT',NULL,NULL),
  (42,'group','I','2026-06-22 23:00+02','FRA','IRQ',NULL,NULL),
  (43,'group','I','2026-06-23 02:00+02','NOR','SEN',NULL,NULL),
  (44,'group','J','2026-06-23 05:00+02','JOR','ALG',NULL,NULL),
  (45,'group','K','2026-06-23 19:00+02','POR','UZB',NULL,NULL),
  (46,'group','L','2026-06-23 22:00+02','ENG','GHA',NULL,NULL),
  (47,'group','L','2026-06-24 01:00+02','PAN','CRO',NULL,NULL),
  (48,'group','K','2026-06-24 04:00+02','COL','COD',NULL,NULL),
  (49,'group','B','2026-06-24 21:00+02','SUI','CAN',NULL,NULL),
  (50,'group','B','2026-06-24 21:00+02','BIH','QAT',NULL,NULL),
  (51,'group','C','2026-06-25 00:00+02','SCO','BRA',NULL,NULL),
  (52,'group','C','2026-06-25 00:00+02','MAR','HAI',NULL,NULL),
  (53,'group','A','2026-06-25 03:00+02','CZE','MEX',NULL,NULL),
  (54,'group','A','2026-06-25 03:00+02','RSA','KOR',NULL,NULL),
  (55,'group','E','2026-06-25 22:00+02','CUW','CIV',NULL,NULL),
  (56,'group','E','2026-06-25 22:00+02','ECU','GER',NULL,NULL),
  (57,'group','F','2026-06-26 01:00+02','JPN','SWE',NULL,NULL),
  (58,'group','F','2026-06-26 01:00+02','TUN','NED',NULL,NULL),
  (59,'group','D','2026-06-26 04:00+02','TUR','USA',NULL,NULL),
  (60,'group','D','2026-06-26 04:00+02','PAR','AUS',NULL,NULL),
  (61,'group','I','2026-06-26 21:00+02','NOR','FRA',NULL,NULL),
  (62,'group','I','2026-06-26 21:00+02','SEN','IRQ',NULL,NULL),
  (63,'group','H','2026-06-27 02:00+02','CPV','KSA',NULL,NULL),
  (64,'group','H','2026-06-27 02:00+02','URU','ESP',NULL,NULL),
  (65,'group','G','2026-06-27 05:00+02','EGY','IRN',NULL,NULL),
  (66,'group','G','2026-06-27 05:00+02','NZL','BEL',NULL,NULL),
  (67,'group','L','2026-06-27 23:00+02','PAN','ENG',NULL,NULL),
  (68,'group','L','2026-06-27 23:00+02','CRO','GHA',NULL,NULL),
  (69,'group','K','2026-06-28 01:30+02','COL','POR',NULL,NULL),
  (70,'group','K','2026-06-28 01:30+02','COD','UZB',NULL,NULL),
  (71,'group','J','2026-06-28 04:00+02','ALG','AUT',NULL,NULL),
  (72,'group','J','2026-06-28 04:00+02','JOR','ARG',NULL,NULL),
  -- ═══ ROUND OF 32 (73-88) ═══
  (73,'r32',NULL,'2026-06-28 21:00+02',NULL,NULL,'Gr A 2.','Gr B 2.'),
  (74,'r32',NULL,'2026-06-29 19:00+02',NULL,NULL,'Gr C 1.','Gr F 2.'),
  (75,'r32',NULL,'2026-06-29 22:30+02',NULL,NULL,'Gr E 1.','3. ABCDF'),
  (76,'r32',NULL,'2026-06-30 03:00+02',NULL,NULL,'Gr F 1.','Gr C 2.'),
  (77,'r32',NULL,'2026-06-30 19:00+02',NULL,NULL,'Gr E 2.','Gr I 2.'),
  (78,'r32',NULL,'2026-06-30 23:00+02',NULL,NULL,'Gr I 1.','3. CDFGH'),
  (79,'r32',NULL,'2026-07-01 03:00+02',NULL,NULL,'Gr A 1.','3. CEFHI'),
  (80,'r32',NULL,'2026-07-01 18:00+02',NULL,NULL,'Gr L 1.','3. EHIJK'),
  (81,'r32',NULL,'2026-07-01 22:00+02',NULL,NULL,'Gr G 1.','3. AEHIJ'),
  (82,'r32',NULL,'2026-07-02 02:00+02',NULL,NULL,'Gr D 1.','3. BEFIJ'),
  (83,'r32',NULL,'2026-07-02 21:00+02',NULL,NULL,'Gr H 1.','Gr J 2.'),
  (84,'r32',NULL,'2026-07-03 01:00+02',NULL,NULL,'Gr K 2.','Gr L 2.'),
  (85,'r32',NULL,'2026-07-03 05:00+02',NULL,NULL,'Gr B 1.','3. EFGIJ'),
  (86,'r32',NULL,'2026-07-03 20:00+02',NULL,NULL,'Gr D 2.','Gr G 2.'),
  (87,'r32',NULL,'2026-07-04 00:00+02',NULL,NULL,'Gr J 1.','Gr H 2.'),
  (88,'r32',NULL,'2026-07-04 03:30+02',NULL,NULL,'Gr K 1.','3. DEIJL'),
  -- ═══ ROUND OF 16 (89-96) ═══
  (89,'r16',NULL,'2026-07-04 19:00+02',NULL,NULL,'Sieger 73','Sieger 75'),
  (90,'r16',NULL,'2026-07-04 23:00+02',NULL,NULL,'Sieger 74','Sieger 77'),
  (91,'r16',NULL,'2026-07-05 22:00+02',NULL,NULL,'Sieger 76','Sieger 78'),
  (92,'r16',NULL,'2026-07-06 02:00+02',NULL,NULL,'Sieger 79','Sieger 80'),
  (93,'r16',NULL,'2026-07-06 21:00+02',NULL,NULL,'Sieger 83','Sieger 84'),
  (94,'r16',NULL,'2026-07-07 02:00+02',NULL,NULL,'Sieger 81','Sieger 82'),
  (95,'r16',NULL,'2026-07-07 18:00+02',NULL,NULL,'Sieger 86','Sieger 88'),
  (96,'r16',NULL,'2026-07-07 22:00+02',NULL,NULL,'Sieger 85','Sieger 87'),
  -- ═══ VIERTELFINALE (97-100) ═══
  (97,'qf',NULL,'2026-07-09 22:00+02',NULL,NULL,'Sieger 89','Sieger 90'),
  (98,'qf',NULL,'2026-07-10 21:00+02',NULL,NULL,'Sieger 93','Sieger 94'),
  (99,'qf',NULL,'2026-07-11 23:00+02',NULL,NULL,'Sieger 91','Sieger 92'),
  (100,'qf',NULL,'2026-07-12 03:00+02',NULL,NULL,'Sieger 95','Sieger 96'),
  -- ═══ HALBFINALE (101-102) ═══
  (101,'sf',NULL,'2026-07-14 21:00+02',NULL,NULL,'Sieger 97','Sieger 98'),
  (102,'sf',NULL,'2026-07-15 21:00+02',NULL,NULL,'Sieger 99','Sieger 100'),
  -- ═══ SPIEL UM PLATZ 3 (103) ═══
  (103,'third',NULL,'2026-07-18 23:00+02',NULL,NULL,'Verlierer 101','Verlierer 102'),
  -- ═══ FINALE (104) ═══
  (104,'final',NULL,'2026-07-19 21:00+02',NULL,NULL,'Sieger 101','Sieger 102')
) AS v(match_no, phase, group_label, kickoff, home_code, away_code, home_label, away_label);
