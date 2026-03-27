import { useState } from "react";

export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState("Asger");

  return (
    <div className="app">

      {/* CONTENT */}
      <div className="page">
        {page === "home" && <Home />}
        {page === "time" && <Time user={user} setUser={setUser} />}
        {page === "orders" && <Orders />}
      </div>

      {/* MOBILE NAV */}
      <div className="bottom-nav">
        <button onClick={() => setPage("home")}>Start</button>
        <button onClick={() => setPage("time")}>Timer</button>
        <button onClick={() => setPage("orders")}>Ordrer</button>
      </div>
    </div>
  );
}

/* ---------- STARTSIDE ---------- */

function Home() {
  return (
    <div className="home">

      <div className="card big">
        <h2>Kort</h2>
        <div className="map">Danmarkskort (kommer)</div>
      </div>

      <div className="card big">
        <h2>Kalender</h2>
        <div className="calendar">
          {["Man","Tir","Ons","Tor","Fre","Lør","Søn"].map((d,i) => (
            <div key={i} className={`day ${i>=5 ? "weekend" : "green"}`}>
              {d}
              <small>Ledig</small>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ---------- TIMER ---------- */

function Time({ user, setUser }) {
  return (
    <div className="time">

      <div className="user-switch">
        <button onClick={() => setUser("Asger")} className={user==="Asger" ? "active":""}>Asger</button>
        <button onClick={() => setUser("Kasper")} className={user==="Kasper" ? "active":""}>Kasper</button>
      </div>

      <div className="card">
        <h2>{user} – Timer</h2>

        <div className="time-row">
          <span>Mandag</span>
          <input type="number" placeholder="Timer"/>
        </div>

        <div className="time-row">
          <span>Tirsdag</span>
          <input type="number" placeholder="Timer"/>
        </div>

        <div className="time-row">
          <span>Onsdag</span>
          <input type="number" placeholder="Timer"/>
        </div>

      </div>
    </div>
  );
}

/* ---------- ORDRER ---------- */

function Orders() {
  return (
    <div className="orders">

      <div className="card">
        <h2>Ordre</h2>
        <p><b>Kunde:</b> Jensen</p>
        <p><b>Opgave:</b> Tag</p>
        <p><b>By:</b> Aarhus</p>
      </div>

    </div>
  );
}
