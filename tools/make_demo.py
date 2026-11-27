# Builds www/demo.json: a made-up painting company for the demo link (?demo).
# Dates are written as "@m+N" = N days after Monday of the current week; the app turns them into real dates when it loads,
# so the demo always looks current. Nothing here is a real person, client or job.
import json, pathlib

ALEX, JORDAN, SAM, CASEY, DREW = 'Alex Rivera', 'Jordan Lee', 'Sam Ortiz', 'Casey Brooks', 'Drew Nolan'
crew = [{'name': JORDAN, 'role': 'Owner'}, {'name': ALEX, 'role': 'Superintendent'}, {'name': SAM, 'role': 'Painter'},
        {'name': CASEY, 'role': 'Painter'}, {'name': DREW, 'role': 'Painter'}]
m = lambda n: f'@m{n:+d}'

def sc(area, scope, product, color, sheen, coats, sqft, gal):
    return {'area': area, 'scope': scope, 'product': product, 'color': color, 'sheen': sheen, 'coats': coats, 'sqft': sqft, 'gallons': gal, 'done': False}

jobs = [
    {'id': 'D-101', 'name': 'Riverside Elementary Repaint', 'gc': 'Ridgeline Construction', 'address': '4100 NE Riverside Ave, Vancouver, WA 98661',
     'type': 'Interior', 'status': 'In Progress', 'super': ALEX, 'start': m(-14), 'end': m(25), 'geo': [45.64, -122.62], 'pw': {'rate': 58.25},
     'site': {'contact': 'Dana Price (GC super)', 'phone': '360-555-0142', 'access': 'Sign in at the front office. Badges at the desk.'},
     'crewNotes': 'Kids in the building until 2:30. Keep halls clear and doors propped only with a spotter.',
     'scope': [sc('Classrooms', 'Walls, 2 coats', 'SW ProMar 200 Zero VOC', 'SW 7015 Repose Gray', 'Eggshell', '2', '350-400 sf/gal', '180'),
               sc('Classrooms', 'Doors and frames', 'SW Pro Industrial Acrylic', 'SW 7005 Pure White', 'Semi-Gloss', '2', '', '24'),
               sc('Gym', 'CMU walls', 'SW Loxon Block Surfacer + ProMar 200', 'TBD (owner picking)', 'Satin', '1 + 2', '75-125 sf/gal', '140'),
               sc('Halls', 'Walls and soffits', 'SW ProMar 200 Zero VOC', 'SW 7015 Repose Gray', 'Eggshell', '2', '', '90')]},
    {'id': 'D-102', 'name': 'Cedar Creek WTP Clarifier Coatings', 'gc': 'Northfork Contractors', 'address': '2200 S Hillhurst Rd, Ridgefield, WA 98642',
     'type': 'Industrial', 'status': 'In Progress', 'super': ALEX, 'start': m(-7), 'end': m(18), 'geo': [45.80, -122.74], 'pw': {'rate': 61.40},
     'site': {'contact': 'Marcus Webb (plant)', 'phone': '360-555-0187', 'access': 'Gate code 4471. Confined space permit at the plant office.'},
     'crewNotes': 'Confined space entry. Attendant and gas monitor every entry, no exceptions.',
     'scope': [sc('Clarifier #1', 'Blast to SSPC-SP10, prime', 'SW Macropoxy 646', 'Mill White', 'Gloss', '1', '', '45'),
               sc('Clarifier #1', 'Finish', 'SW Tile-Clad HS', 'Safety Blue', 'Gloss', '1', '', '40'),
               sc('Pipe gallery', 'Piping and supports', 'SW Pro Industrial DTM Acrylic', 'Color-coded per plant', 'Semi-Gloss', '2', '', '30')]},
    {'id': 'D-103', 'name': "St. Anne's Fellowship Hall", 'gc': 'Summit Builders', 'address': '615 NE 4th Ave, Camas, WA 98607',
     'type': 'Interior', 'status': 'In Progress', 'super': ALEX, 'start': m(-3), 'end': m(9), 'geo': [45.59, -122.40],
     'site': {'contact': 'Pastor Ellen Hart', 'phone': '360-555-0110', 'access': 'Side door by the parking lot. No work Sunday.'},
     'crewNotes': '',
     'scope': [sc('Hall', 'Walls', 'SW Emerald Interior', 'SW 7036 Accessible Beige', 'Matte', '2', '', '55'),
               sc('Hall', 'Wood trim and beams', 'SW Emerald Urethane Trim Enamel', 'SW 7006 Extra White', 'Satin', '2', '', '12'),
               sc('Kitchen', 'Walls and ceiling', 'SW ProMar 200 Zero VOC', 'SW 7006 Extra White', 'Semi-Gloss', '2', '', '20')]},
    {'id': 'D-104', 'name': 'Columbia Bluffs Visitor Center', 'gc': 'Cascade General', 'address': '900 Bluffs Trail Rd, Longview, WA 98632',
     'type': 'Exterior', 'status': 'In Progress', 'super': JORDAN, 'start': m(-10), 'end': m(11), 'geo': [46.14, -122.94], 'pw': {'rate': 58.25},
     'site': {'contact': 'Ray Kim (Cascade PM)', 'phone': '360-555-0163'},
     'crewNotes': 'Long drive. Meet at the shop 5:30 am. Watch the rain window; no coating below 50°F.',
     'scope': [sc('Exterior', 'Cedar siding', 'SW Emerald Exterior', 'SW 7069 Iron Ore', 'Satin', '2', '250-300 sf/gal', '85'),
               sc('Exterior', 'Steel canopy', 'SW Pro Industrial DTM Acrylic', 'SW 7069 Iron Ore', 'Semi-Gloss', '2', '', '18'),
               sc('Exterior', 'Concrete stem walls', 'SW Loxon XP', 'TBD (awaiting colors)', 'Flat', '2', '100-200 sf/gal', '30')]},
    {'id': 'D-105', 'name': 'Harbor Point Apartments', 'gc': 'Summit Builders', 'address': '1800 SW Harbor Point Dr, Battle Ground, WA 98604',
     'type': 'Exterior', 'status': 'Not Started', 'super': ALEX, 'start': m(14), 'end': m(60), 'geo': [45.78, -122.53],
     'site': {'contact': 'Mia Torres (property manager)', 'phone': '360-555-0129'}, 'crewNotes': '',
     'scope': [sc('Buildings A-D', 'Hardie siding', 'SW Duration Exterior', 'SW 7647 Crushed Ice', 'Satin', '1', '', '420'),
               sc('Buildings A-D', 'Trim and fascia', 'SW Duration Exterior', 'SW 7006 Extra White', 'Satin', '1', '', '110')]},
    {'id': 'D-106', 'name': 'Northgate Medical Office TI', 'gc': 'Ridgeline Construction', 'address': '7300 NE Northgate Blvd, Portland, OR 97211',
     'type': 'Interior', 'status': 'Not Started', 'super': ALEX, 'start': m(21), 'end': m(35), 'geo': [45.57, -122.64], 'crewNotes': '',
     'site': {'contact': 'Dana Price (GC super)', 'phone': '360-555-0142'},
     'scope': [sc('Suite 200', 'Walls', 'SW ProMar 200 Zero VOC', 'SW 7029 Agreeable Gray', 'Eggshell', '2', '', '70'),
               sc('Suite 200', 'Exam rooms', 'SW Pro Industrial Waterbased Catalyzed Epoxy', 'SW 7006 Extra White', 'Semi-Gloss', '2', '', '25')]},
    {'id': 'D-098', 'name': 'Maple Grove Library', 'gc': 'Cascade General', 'address': '220 Maple Grove Rd, Ridgefield, WA 98642',
     'type': 'Interior + Exterior', 'status': 'Complete', 'super': JORDAN, 'start': m(-60), 'end': m(-20), 'geo': [45.81, -122.73], 'crewNotes': '',
     'site': {}, 'scope': [sc('Interior', 'Walls', 'SW ProMar 200 Zero VOC', 'SW 7008 Alabaster', 'Eggshell', '2', '', '60')]},
]

row = 2
for j in jobs:
    for s in j['scope']: s['row'] = row; row += 1

S = []
def day(n, job, who, start, notes=''):
    S.append({'date': m(n), 'job': job, 'crew': who, 'start': start, 'notes': notes, 'from': m(n), 'thru': ''})
for w in (-7, 0, 7, 14):
    day(w + 0, 'D-101', [ALEX, SAM], '07:00', 'Classrooms 104-108. Cut and roll, second coat.' if w == 0 else '')
    day(w + 1, 'D-101', [SAM, CASEY], '07:00', 'Gym CMU: block fill the east wall.' if w == 0 else '')
    day(w + 2, 'D-101', [ALEX, SAM], '07:00', '')
    day(w + 3, 'D-101', [SAM, CASEY], '07:00', '')
    day(w + 4, 'D-101', [CASEY], '07:00', 'Touch-ups and punch list.' if w == 0 else '')
    if w < 14:
        day(w + 0, 'D-102', [DREW, CASEY], '06:30', 'Blast clarifier #1, east half. Permit first.' if w == 0 else '')
        day(w + 1, 'D-102', [DREW, ALEX], '06:30', 'Prime coat Macropoxy, check DFT every 100 sf.' if w == 0 else '')
        day(w + 3, 'D-102', [DREW], '06:30', '')
    if w in (0, 7):
        day(w + 2, 'D-103', [CASEY, DREW], '08:00', 'Wood trim first coat. Church event Thursday night, clean up by 3.' if w == 0 else '')
        day(w + 4, 'D-103', [ALEX, DREW], '08:00', '')
    if w in (-7, 0, 7):
        day(w + 1, 'D-104', [JORDAN], '06:00', 'Site walk with Ray, confirm colors.' if w == 0 else '')
        day(w + 2, 'D-104', [JORDAN, CASEY] if w else [JORDAN], '06:00', '')
        day(w + 4, 'D-104', [SAM, JORDAN], '06:00', 'Steel canopy, DTM second coat if dry.' if w == 0 else '')
for i, r in enumerate(S): r['row'] = i + 2

R = []
def rc(n, job, amt, cat, card, vendor, by, notes=''):
    R.append({'date': m(n), 'job': job, 'amount': amt, 'cat': cat, 'card': card, 'vendor': vendor, 'notes': notes, 'by': by})
rc(-12, 'D-101', 412.80, 'Materials', 'General card', 'Sherwin-Williams Vancouver', ALEX, '24 gal ProMar 200')
rc(-11, 'D-101', 68.40, 'Fuel', 'Gas card', 'Chevron', SAM)
rc(-9, 'D-104', 92.15, 'Fuel', 'Gas card', 'Shell Longview', JORDAN)
rc(-8, 'D-104', 186.00, 'Lodging', 'General card', 'Riverfront Inn', JORDAN)
rc(-7, 'D-102', 1240.00, 'Equipment', 'General card', 'Northwest Rentals', DREW, 'Blast pot and compressor, 1 week')
rc(-6, 'D-102', 63.25, 'Food', 'General card', 'Burgerville', DREW, 'Crew lunch')
rc(-5, 'D-101', 238.60, 'Materials', 'General card', 'Sherwin-Williams Vancouver', CASEY, 'Block surfacer')
rc(-4, 'D-102', 74.90, 'Fuel', 'Gas card', 'Arco', DREW)
rc(-3, 'D-103', 315.40, 'Materials', 'General card', 'Sherwin-Williams Camas', ALEX, 'Emerald trim enamel')
rc(-2, 'D-104', 58.10, 'Fuel', 'Gas card', 'Chevron', CASEY)
rc(0, 'D-101', 41.75, 'Other', 'General card', 'Home Depot', SAM, 'Drop cloths and tape')
for i, r in enumerate(R): r['row'] = i + 2

d = {'updated': '@now', 'crew': crew, 'jobs': jobs, 'schedule': S, 'receipts': R,
     'demoUser': ALEX}
pathlib.Path('www/demo.json').write_text(json.dumps(d, separators=(',', ':')))
print(len(S), 'schedule rows,', len(R), 'receipts,', round(len(json.dumps(d)) / 1024), 'KB')
