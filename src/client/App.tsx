import { useEffect, useState } from "react";
import { Credits } from "./Credits";
import { navigate } from "./nav";
import { Room } from "./Room";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const CODE_LENGTH = 5;

function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

type Route = { page: "home" } | { page: "credits" } | { page: "room"; code: string };

function parseRoute(): Route {
  const path = decodeURIComponent(location.pathname.slice(1));
  if (path === "credits") return { page: "credits" };
  const code = normalizeCode(path);
  return code.length >= 4 ? { page: "room", code } : { page: "home" };
}

export function App() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (route.page === "room") return <Room key={route.code} code={route.code} />;
  if (route.page === "credits") return <Credits />;
  return <Home />;
}

function Home() {
  const [code, setCode] = useState("");
  const valid = code.length >= 4;
  return (
    <main className="screen home">
      <h1 className="title">Secret Hitler</h1>
      <p className="subtitle">Das Spiel für 5–10 Leute im selben Raum – jeder mit seinem Handy.</p>

      <button className="btn primary big" onClick={() => navigate(`/${newRoomCode()}`)}>
        Neues Spiel erstellen
      </button>

      <form
        className="join-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) navigate(`/${code}`);
        }}
      >
        <label htmlFor="code">Oder Raumcode eingeben</label>
        <div className="row">
          <input
            id="code"
            className="code-input"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="ABCDE"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          <button className="btn" disabled={!valid}>
            Beitreten
          </button>
        </div>
      </form>

      <p className="hint">
        Tipp: In Safari auf <b>Teilen → Zum Home-Bildschirm</b> tippen, dann startet das Spiel wie eine App im
        Vollbild.
      </p>
      <footer className="footer">
        <a
          href="/credits"
          onClick={(e) => {
            e.preventDefault();
            navigate("/credits");
          }}
        >
          Credits &amp; Lizenz
        </a>
      </footer>
    </main>
  );
}
