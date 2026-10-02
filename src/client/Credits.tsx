import { navigate } from "./nav";

export function Credits() {
  return (
    <main className="screen credits">
      <button className="btn link back" onClick={() => navigate("/")}>
        ← Zurück
      </button>
      <h1 className="title small">Credits &amp; Lizenz</h1>
      <p>
        <b>Secret Hitler</b> wurde entworfen von Max Temkin, Mike Boxleiter und Tommy Maranges, illustriert von
        Mackenzie Schubert, und wird von Goat, Wolf &amp; Cabbage LLC herausgegeben (© 2016). Das Spiel steht unter
        der Lizenz{" "}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de" target="_blank" rel="noreferrer">
          Creative Commons BY-NC-SA 4.0
        </a>
        . Original: <a href="https://www.secrethitler.com">secrethitler.com</a>.
      </p>
      <p>
        Die Grafiken stammen aus der Adaption des Projekts{" "}
        <a href="https://github.com/ShrimpCryptid/Secret-Hitler-Online" target="_blank" rel="noreferrer">
          Secret Hitler Online
        </a>{" "}
        (ShrimpCryptid, CC BY-NC-SA 4.0), die die Originalgrafiken leicht angepasst hat. Für diese App wurden sie
        verkleinert und ins WebP-Format umgewandelt. Schrift: Germania One (SIL Open Font License).
      </p>
      <p>
        Diese App ist ein privates, nicht-kommerzielles Fanprojekt. Sie ist nicht mit Goat, Wolf &amp; Cabbage
        verbunden oder von ihnen unterstützt. Die angepassten Grafiken stehen ebenfalls unter CC BY-NC-SA 4.0.
      </p>
    </main>
  );
}
