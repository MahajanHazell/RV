-- Seed Data Migration
-- 
-- Inserts initial seed data into the database
-- Populates museums, tickets, and initial content

-- Insert museum (only if it doesn't already exist)
INSERT INTO museums (name, city, state)
SELECT 'Buffalo AKG Art Museum', 'Buffalo', 'NY'
WHERE NOT EXISTS (
    SELECT 1 FROM museums WHERE name = 'Buffalo AKG Art Museum'
);

-- Insert 3 ticket codes for the museum
INSERT INTO ticket_codes (museum_id, code_hash, is_active, valid_from, valid_to)
SELECT 
    id,
    'demo_hash_1',
    true,
    now() - interval '1 day',
    now() + interval '30 days'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'demo_hash_2',
    true,
    now() - interval '1 day',
    now() + interval '30 days'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'demo_hash_3',
    true,
    now() - interval '1 day',
    now() + interval '30 days'
FROM museums
WHERE name = 'Buffalo AKG Art Museum';

-- Insert content chunks for the museum
INSERT INTO content_chunks (museum_id, chunk_text, source_url)
SELECT 
    id,
    'The Buffalo AKG Art Museum is one of the oldest public art institutions in the United States, with a collection spanning from ancient to contemporary art. The museum features works by renowned artists including Jackson Pollock, Mark Rothko, and Andy Warhol. Visitors can explore diverse exhibitions across multiple galleries showcasing paintings, sculptures, and multimedia installations.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The museum is open Tuesday through Sunday from 10 AM to 5 PM, with extended hours until 8 PM on Fridays. Admission is free on the first Friday of each month from 5 PM to 8 PM. The museum is closed on Mondays and major holidays, so plan your visit accordingly.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The Buffalo AKG Art Museum is fully accessible with wheelchair-accessible entrances, elevators, and restrooms throughout the building. Assistive listening devices and large-print materials are available upon request. Service animals are welcome, and the museum offers accessible parking spaces near the main entrance.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The museum is best known for its exceptional collection of Abstract Expressionist works, particularly pieces from the 1950s and 1960s. The AKG houses one of the most comprehensive collections of modern and contemporary art in the region. Special attention is given to works by artists with connections to Western New York.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'For a first-time visit, allow at least 2-3 hours to explore the main galleries. Start with the permanent collection on the second floor, then move to special exhibitions. The museum offers guided tours on weekends, and audio guides are available for self-guided exploration. Don''t miss the outdoor sculpture garden during warmer months.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'When visiting, please maintain a respectful distance from artworks and avoid touching any pieces. Photography is permitted in most galleries for personal use, but flash photography and tripods are prohibited. Large bags and backpacks should be checked at the coat room for the safety of the artwork.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The museum features a café offering light meals, coffee, and refreshments, perfect for a midday break. The gift shop stocks art books, prints, and unique souvenirs related to current exhibitions. Free Wi-Fi is available throughout the building, and charging stations can be found in the lobby area.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'Parking is available in the museum''s adjacent lot, with metered street parking also accessible nearby. The museum is easily reachable by public transportation, with several bus routes stopping within walking distance. Bicycle parking is available for visitors who prefer to cycle to the museum.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The Buffalo AKG regularly hosts educational programs including artist talks, workshops, and family-friendly activities. School groups can arrange guided tours by contacting the education department in advance. The museum also offers adult art classes and lectures on various art historical topics throughout the year.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'Special exhibitions rotate throughout the year, featuring both traveling shows and curated selections from the permanent collection. Check the museum''s website or call ahead to see what''s currently on display. Members receive early access to new exhibitions and discounts on special programs.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The museum''s collection includes significant works from the 19th century through contemporary art, with particular strengths in American painting and sculpture. European art is also well-represented, including Impressionist and Post-Impressionist pieces. The contemporary galleries feature cutting-edge works by emerging and established artists.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'Group visits are welcome, and discounts are available for groups of 10 or more when booked in advance. The museum can accommodate private events and receptions in designated spaces. Corporate memberships and sponsorship opportunities are available for businesses interested in supporting the arts.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'The museum building itself is an architectural landmark, with recent renovations enhancing both the exhibition spaces and visitor amenities. The design seamlessly blends historic elements with modern additions, creating an inspiring environment for experiencing art. Natural light fills many galleries, providing optimal viewing conditions.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum'
UNION ALL
SELECT 
    id,
    'Visitors should plan to arrive early, especially on weekends when the museum tends to be busier. The quietest times are typically weekday mornings. Allow extra time if you plan to visit special exhibitions, as they often require separate timed entry tickets that can be reserved online in advance.',
    'https://www.buffaloakg.org'
FROM museums
WHERE name = 'Buffalo AKG Art Museum';
