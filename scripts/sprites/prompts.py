"""Builds the Higgsfield prompts for every sprite strip and writes manifest.json.

One strip = one (stage, sex, wealth): three figures, healthy / normal / sick.
The 'regular' strip of each character is generated first; rags and wealthy
strips reuse it as an image reference so the face stays the same person.
Skin is always medium tan (#C68642); the game recolors it at runtime, so
clothing stays out of the tan/orange/gold hue band.
"""
import json
import pathlib
import sys

STAGES = {
    "baby": {
        "who": {"male": "baby boy (about 1 year old), sitting upright", "female": "baby girl (about 1 year old), sitting upright"},
        "hair": {"male": "short wisps of black hair", "female": "short wisps of black hair with a tiny tuft"},
        "healthy": "chubby and plump, rosy cheeks, bright eyes, big happy smile",
        "normal": "ordinary baby proportions, calm neutral expression",
        "sick": "thin and frail, pale, teary eyes, runny nose, droopy and miserable",
        "outfit": {
            "rags": {"male": "a dirty torn grey cloth diaper and a stained grey undershirt", "female": "a dirty torn grey cloth diaper and a stained grey undershirt"},
            "regular": {"male": "a light blue onesie", "female": "a pink onesie"},
            "wealthy": {"male": "an elegant white and navy designer baby outfit with a tiny navy bow tie", "female": "an elegant white lace baby dress with a navy ribbon"},
        },
    },
    "child": {
        "who": {"male": "boy (about 8 years old)", "female": "girl (about 8 years old)"},
        "hair": {"male": "short black hair", "female": "black hair in two pigtails"},
        "healthy": "sturdy and energetic, rosy cheeks, big grin, confident stance",
        "normal": "average build, relaxed, neutral expression",
        "sick": "skinny and frail, sunken eyes with dark circles, slouched, sad",
        "outfit": {
            "rags": {"male": "a torn, dirty, faded grey t-shirt and ragged grey shorts, barefoot", "female": "a torn, dirty, faded grey dress, barefoot"},
            "regular": {"male": "a green t-shirt, blue denim shorts, white sneakers", "female": "a green t-shirt, blue denim skirt, white sneakers"},
            "wealthy": {"male": "a private school uniform: navy blazer, white shirt, grey trousers, polished black shoes", "female": "a private school uniform: navy blazer, white shirt, pleated navy skirt, polished black shoes"},
        },
    },
    "teen": {
        "who": {"male": "teenage boy (about 15 years old)", "female": "teenage girl (about 15 years old)"},
        "hair": {"male": "messy short black hair", "female": "long black hair in a ponytail"},
        "healthy": "athletic and fit, upright posture, bright confident smile" ,
        "normal": "average build, slightly bored expression",
        "sick": "gaunt and frail, pale, dark circles under the eyes, hunched, exhausted",
        "outfit": {
            "rags": {"male": "a worn-out torn faded grey hoodie and ragged dark grey pants, broken black sandals", "female": "a worn-out torn faded grey hoodie and ragged dark grey pants, broken black sandals"},
            "regular": {"male": "a purple hoodie, blue jeans, white sneakers", "female": "a purple hoodie, blue jeans, white sneakers"},
            "wealthy": {"male": "designer streetwear: black designer jacket, slim black jeans, crisp white luxury sneakers, silver chain", "female": "designer streetwear: black designer jacket, white top, slim black jeans, crisp white luxury sneakers, silver earrings"},
        },
    },
    "young": {
        "who": {"male": "young adult man (about 25 years old)", "female": "young adult woman (about 25 years old)"},
        "hair": {"male": "short black hair", "female": "long straight black hair"},
        "outfit": {
            "rags": {"male": "a torn, dirty, faded grey shirt and ragged dark grey pants, barefoot", "female": "a torn, dirty, faded grey dress, barefoot"},
            "regular": {"male": "a plain red t-shirt, blue jeans, white sneakers", "female": "a plain red top, blue jeans, white sneakers"},
            "wealthy": {"male": "a tailored navy suit, white shirt, silver watch, black leather shoes", "female": "an elegant navy dress, silver jewelry, black heels"},
        },
    },
    "adult": {
        "who": {"male": "middle-aged man (about 45 years old)", "female": "middle-aged woman (about 45 years old)"},
        "hair": {"male": "short black hair with a few grey streaks", "female": "shoulder-length black hair with a few grey streaks"},
        "outfit": {
            "rags": {"male": "patched, dirty grey work clothes and worn black rubber sandals", "female": "a patched, dirty grey housedress and worn black rubber sandals"},
            "regular": {"male": "a light blue button-up shirt, dark grey trousers, black shoes", "female": "a light blue blouse, dark grey trousers, black shoes"},
            "wealthy": {"male": "a luxury charcoal three-piece suit, burgundy tie, silver watch, black leather shoes", "female": "an elegant burgundy designer dress with a black blazer, pearl necklace, black heels"},
        },
    },
    "senior": {
        "who": {"male": "elderly man (about 75 years old)", "female": "elderly woman (about 75 years old)"},
        "hair": {"male": "thin white hair", "female": "white hair in a neat bun"},
        "healthy": "fit and energetic for their age, upright posture, lively warm smile",
        "normal": "slightly stooped, calm expression",
        "sick": "very frail and bony, pale, deeply hunched, leaning on a black walking cane, tired eyes",
        "outfit": {
            "rags": {"male": "a threadbare stained grey cardigan, old grey trousers, worn black slippers", "female": "a threadbare stained grey cardigan over an old grey skirt, worn black slippers"},
            "regular": {"male": "a green cardigan over a white shirt, grey trousers, black shoes", "female": "a green cardigan over a white blouse, grey skirt, black shoes"},
            "wealthy": {"male": "an elegant navy velvet blazer, white shirt, burgundy silk scarf, black leather shoes", "female": "an elegant navy dress, pearl necklace, burgundy silk scarf, black shoes"},
        },
    },
}

ADULT_HEALTH = {
    "male": "athletic and muscular, broad shoulders, defined arms, upright confident posture, bright eyes, slight smile",
    "female": "toned, curvy and thick: strong thighs and hips, fit glowing look, upright confident posture, bright eyes, slight smile",
}
ADULT_NORMAL = "average build, relaxed posture, neutral expression"
ADULT_SICK = "gaunt and frail, visibly thinner limbs, sunken cheeks, dark circles under the eyes, hunched shoulders, weary expression, clothes hanging loose"



def prompt(stage: str, sex: str, wealth: str) -> str:
    s = STAGES[stage]
    pron, poss = ("He", "his") if sex == "male" else ("She", "her")
    healthy = s.get("healthy") or ADULT_HEALTH[sex]
    if stage == "teen" and sex == "female":
        healthy = "fit, toned and curvy, upright posture, bright confident smile"
    normal = s.get("normal", ADULT_NORMAL)
    sick = s.get("sick", ADULT_SICK)
    if wealth != "regular":
        # Outfit variants are edits of the regular strip (passed as image reference).
        return (
            "Edit the reference image. Keep the three figures exactly as they are: same face, hair, medium tan skin, "
            "body shapes, poses, expressions, positions, scale and pixel art style (very healthy, normal, sick from left "
            f"to right). Only change the outfit of all three to: {s['outfit'][wealth][sex]}. On the sick figure the "
            "clothes hang loose. Keep the plain flat light grey background. Clothing colors only from grey, white, "
            "black, blue, navy, green, red, purple, pink, burgundy and silver. No text."
        )
    return (
        "Pixel art video game character sprites. Three full-body figures side by side on a plain flat light grey "
        "background (#D0D0D0), evenly spaced, each centered in its own third of the image, same scale, feet on the same "
        "baseline, facing the viewer.\n"
        f"All three are the SAME {s['who'][sex]}: same face, {s['hair'][sex]}, medium tan skin (#C68642), "
        "the skin color is identical in all three.\n"
        f"{pron} wears the SAME outfit in all three: {s['outfit'][wealth][sex]}.\n"
        f"Only {poss} body and condition change, left to right:\n"
        f"1. Very healthy: {healthy}.\n"
        f"2. Normal: {normal}.\n"
        f"3. Sick: {sick}.\n"
        "Clothing colors only from grey, white, black, blue, navy, green, red, purple, pink, burgundy and silver.\n"
        "Style: detailed 16-bit pixel art, crisp hard-edged square pixels, limited palette, dark outline, no anti-aliasing, "
        "no ground shadow. No text, no labels, no numbers, no frames or borders."
    )


def main() -> None:
    out = pathlib.Path(__file__).with_name("manifest.json")
    entries = [
        {"key": f"{stage}_{sex}_{wealth}", "stage": stage, "sex": sex, "wealth": wealth, "prompt": prompt(stage, sex, wealth)}
        for stage in STAGES for sex in ("male", "female") for wealth in ("regular", "rags", "wealthy")
    ]
    out.write_text(json.dumps(entries, indent=2))
    wanted = sys.argv[1] if len(sys.argv) > 1 else "regular"
    batch = [
        {"index": i, "key": e["key"], "params": {"model": "nano_banana_pro", "aspect_ratio": "16:9", "resolution": "2k", "use_unlim": False, "prompt": e["prompt"]}}
        for i, e in enumerate(x for x in entries if x["wealth"] == wanted)
    ]
    print(json.dumps(batch))


if __name__ == "__main__":
    main()
