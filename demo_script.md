# OpenPaws — Demo Script

---

"Alright so let me show you what we've been building.

So the basic problem we're trying to solve is — imagine you're a small nonprofit, you've got maybe one or two lawyers on staff, and you're trying to take on a federal animal law case. The kind of research you'd need to do — finding relevant court cases, understanding how strong your argument is, what's worked before and what hasn't — that takes days at a proper law firm. These teams just don't have that.

So what OpenPaws does is it takes your legal claim, searches through a database of real federal court cases, and gives you back a proper risk assessment. With actual citations, not made-up ones.

Let me just show you."

**[go to Examples, click Try This on one of the cards]**

"So I'm going to grab one of these pre-built examples — this is a Supreme Court standing argument — and just run it through.

Before I hit submit, let me show you a couple of things. You pick your jurisdiction first — so which court you're filing in. We cover the Supreme Court and five federal circuits. And one thing that's nice here is if you pick say the 9th Circuit, it automatically pulls in Supreme Court cases too, because those are binding anyway.

Then you set where you are in the case — motion to dismiss, summary judgment, preliminary injunction — because what's relevant at each stage is actually pretty different.

And there's an advanced section here where you can narrow by date range, or adjust how deep the search goes — more depth means more cases, a bit slower."

**[hit submit, let it run]**

"Okay so it's running now. What's happening behind the scenes is it's taking the claim, searching for the most similar cases in the database — not by keywords, it actually understands the meaning — and then building the assessment from whatever it finds.

And here's the result."

**[results are showing]**

"So you've got your confidence band at the top — this one's High — your summary, your risk factors, and the cases it's citing at the bottom.

Now the thing I really want to point out here is the citations. This is where we're actually different from just going to ChatGPT and asking the same question. ChatGPT will give you citations that sound completely real but just don't exist — it's a well-known problem. We built the whole system so that literally cannot happen. The AI is only allowed to reference cases that were actually pulled from the database. And then there's a second check that runs over every single citation before it shows up on your screen.

And that confidence band — High, Medium, Low — it's not the AI saying 'I think this looks pretty good.' It's calculated from actual signals — how many relevant cases came back, how well they matched your jurisdiction, how many citations passed the check. It's objective. If the coverage is thin, it'll tell you Low, or sometimes it'll just refuse to answer rather than give you something unreliable."

**[go to Sources]**

"There's also a Sources page — we just wanted to be fully transparent about where the case law comes from. Right now it's seeded from the largest animal law database in the world, and we're adding more over time. Everything is federal only — no state court cases — which keeps the jurisdiction side of things accurate.

And over here in History, every search you run gets saved, so you can come back to it, filter through past assessments, which is actually pretty useful when you're building out a case over a few weeks."

**[back to homepage]**

"Yeah so that's basically it. The idea is just — give a small two-person advocacy team the same research depth you'd get at a big firm, but in like thirty seconds instead of two days. And be honest about what it knows and what it doesn't."

---

## If They Ask Questions

**"Why not just use ChatGPT?"**
"The big issue is it makes up cases. Sounds confident, cites something that doesn't exist. We specifically built around that — the model can only cite what's in the database."

**"How does the search work?"**
"It converts your claim into a kind of mathematical fingerprint and finds the closest matching cases — so it gets meaning, not just matching words."

**"How big is the database right now?"**
"It's actively growing. The confidence bands are always honest about coverage depth, so you know exactly how much to lean on any given result."

**"Is this legal advice?"**
"No, and we're upfront about that everywhere. It's a research tool — helps lawyers move faster, doesn't replace them."
