"""Generate item pictures with Gemini (see docs/ITEM-IMAGES.md).
Usage: python3 scripts/item-art/gen.py [ids...]   -> make the listed ids (all missing ones if none)
       FORCE=1 to remake existing files. Needs env GEMINI_API_KEY; optional MODEL, RAW (full-size copies).
Writes public/items/<id>.webp (256x256). Kind/slot fallback icons have ids starting with "kind-" / "wear-"."""
import base64, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "items")
RAW = os.environ.get("RAW")
MODEL = os.environ.get("MODEL", "gemini-3-pro-image")
STYLE = ("A single fantasy RPG inventory icon: the object alone, centered, filling most of the square, slight three-quarter view, "
         "painterly digital art, rich textures, warm rim light, soft shadow, on a plain very dark charcoal background "
         "with a subtle vignette, no hands, no people, no text, no letters, no frame, no border, no watermark. "
         "The object fills the image edge to edge on the dark background: no framed picture, no inner panel, "
         "no inset square, no white background.")

# Items the party carries, plus every weapon, armor and shield. Extra words where the SRD name alone is unclear.
HINTS = {
    "arrows": "a small bundle of wooden arrows with grey feather fletching",
    "ball-bearings": "a small open cloth pouch spilling tiny steel ball bearings",
    "bedroll": "a rolled-up wool bedroll tied with leather straps",
    "bell": "a small brass hand bell",
    "blanket": "a folded thick wool blanket",
    "book": "a closed leather-bound book with brass corners",
    "calligraphers-supplies": "calligrapher's supplies: an ink bottle, quill pens and a small brush on a parchment",
    "caltrops": "a handful of small iron caltrops (four-pointed spikes)",
    "clothes-travelers": "folded traveler's clothes: a sturdy tunic, trousers and a hooded cloak",
    "healers-kit": "a healer's kit: a small leather satchel with bandages, salves and splints",
    "holy-water": "a small glass flask of holy water glowing faintly with soft golden light",
    "lamp": "a brass oil lamp with a small flame",
    "lantern-hooded": "a hooded iron lantern with a glowing flame and a sliding metal hood",
    "oil": "a small clay flask of lamp oil with a cork stopper",
    "parchment": "a few sheets of rolled parchment tied with string",
    "pouch": "a small leather belt pouch with a drawstring",
    "quiver": "an empty leather quiver for arrows",
    "rations": "travel rations: dried meat, hard bread and dried fruit wrapped in cloth",
    "robe": "a folded hooded cloth robe",
    "rope": "a coiled hempen rope",
    "sprig-of-mistletoe": "a sprig of green mistletoe with white berries tied with twine, a druidic focus",
    "thieves-tools": "thieves' tools: a small leather roll of lockpicks, a file and a tiny mirror",
    "tinderbox": "a small open tin tinderbox holding a flint, a steel striker and tinder",
    "torch": "a wooden torch with burning flame",
    "waterskin": "a leather waterskin with a stopper",
    "musket": "a long fantasy flintlock musket rifle with a full wooden stock", "pistol": "a fantasy flintlock pistol",
    "warhammer": "a war hammer: a heavy square steel hammer head on a long handle (not an axe)",
    "light-hammer": "a small one-handed throwing war hammer",
    "padded-armor": "a quilted padded cloth armor vest", "shield": "a round wooden shield with an iron rim and boss",
    "blowgun": "a long wooden blowgun with a few small needles", "sling": "a leather sling with a few round stones",
    "whip": "a coiled leather whip", "lance": "a long cavalry lance",
    "hide-armor": "crude hide armor made of thick furs and pelts", "ring-mail": "ring mail: a leather coat with heavy iron rings sewn on",
    "splint-armor": "splint armor of vertical metal strips riveted to leather", "half-plate-armor": "half plate armor: a steel breastplate and shoulder plates",
    "breastplate": "a fitted steel breastplate",
}
KIND = {
    "kind-weapon": "a sword and an axe crossed", "kind-armor": "a suit of chain armor on a stand", "kind-shield": "a round wooden shield",
    "kind-ammunition": "a small bundle of arrows and crossbow bolts", "kind-pack": "a full adventurer's backpack with a bedroll on top",
    "kind-tool": "a small set of craftsman's tools: hammer, tongs and chisel", "kind-focus": "a glowing crystal orb on a small stand",
    "kind-gear": "a coil of rope, a torch and a small sack", "kind-poison": "a small dark glass vial of green poison with a skull-shaped stopper",
    "kind-item": "a small closed wooden treasure chest with iron bands",
    "wear-head": "a steel helmet", "wear-neck": "a gold amulet with a gemstone on a chain", "wear-hands": "a pair of leather gloves",
    "wear-ring": "a gold ring with a gemstone", "wear-cloak": "a folded dark green cloak with a brooch", "wear-body": "a cloth tunic",
    "wear-legs": "a pair of leather thigh and shin guards (leg armor, not boots)", "wear-feet": "a pair of leather boots", "wear-back": "a leather backpack",
}

def items():
    eq = json.load(open(os.path.join(ROOT, "src", "data", "srd-equipment.json")))["items"]
    own = set(HINTS) - {"musket", "pistol", "padded-armor", "blowgun", "sling", "whip", "lance", "hide-armor", "ring-mail",
                        "splint-armor", "half-plate-armor", "breastplate"}
    own |= {"backpack", "candle", "chain-mail", "chain-shirt", "crowbar", "dagger", "flail", "greatsword", "javelin",
            "leather-armor", "longbow", "longsword", "mace", "scimitar", "shortbow", "shortsword", "spear", "studded-leather-armor"}
    out = {}
    for i in eq:
        if i["kind"] in ("weapon", "armor", "shield") or i["id"] in own:
            out[i["id"]] = HINTS.get(i["id"], f"a {i['name'].lower()} ({'D&D ' + i['kind']})")
    out.update(KIND)
    return out

def call(text):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    body = {"contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1"}}}
    req = urllib.request.Request(url, json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for _ in range(3):
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
        except Exception as e:  # noqa: BLE001 (retry network and HTTP errors)
            print("error", e); time.sleep(20); continue
        imgs = [p["inlineData"] for c in r.get("candidates", []) for p in c.get("content", {}).get("parts", []) if "inlineData" in p]
        if imgs: return base64.b64decode(imgs[-1]["data"])
        print("no image", json.dumps(r)[:300])
    return None

def make(item):
    iid, what = item
    path = os.path.join(OUT, f"{iid}.webp")
    if os.path.exists(path) and not os.environ.get("FORCE"): return
    data = call(f"{what}. {STYLE}")
    if not data: print("FAILED", iid); return
    if RAW: open(os.path.join(RAW, f"{iid}.jpg"), "wb").write(data)
    Image.open(io.BytesIO(data)).convert("RGB").resize((256, 256), Image.LANCZOS).save(path, "WEBP", quality=78, method=6)
    print("ok", iid, os.path.getsize(path))

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True); RAW and os.makedirs(RAW, exist_ok=True)
    todo = items()
    pick = [(k, todo[k]) for k in sys.argv[1:]] if sys.argv[1:] else list(todo.items())
    with ThreadPoolExecutor(4) as ex: list(ex.map(make, pick))
