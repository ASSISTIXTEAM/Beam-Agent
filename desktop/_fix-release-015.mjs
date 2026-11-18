import fs from "node:fs";

const files = [
	"C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/desktop-runtime.json",
	"C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/desktop-runtime.json",
	"C:/Users/Alexa/BeamAgent/resources/app/beam/desktop-runtime.json",
];
for (const f of files) {
	const j = JSON.parse(fs.readFileSync(f, "utf8"));
	const before = j.release.version;
	j.release.version = "0.1.6";
	fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
	console.log(f, before, "->", j.release.version);
}
const mains = [
	"C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/lib/main.js",
	"C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/lib/main.js",
	"C:/Users/Alexa/BeamAgent/resources/app/lib/main.js",
];
for (const f of mains) {
	const s = fs.readFileSync(f, "utf8");
	console.log(
		f,
		"host+auth=",
		s.includes("wait for host+auth only"),
		"soft=",
		s.includes("BEAM_RUNTIME_VERSION_SOFT"),
		"14000=",
		s.includes(", 14000)"),
	);
}
