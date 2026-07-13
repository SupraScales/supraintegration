const serviceLinks = ["AI agents", "Growth marketing", "Revenue operations", "SOPs"];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="footer-brand">
          <b>SUPRA<span>INTEGRATION</span></b>
          <p>Growth systems for small businesses that need more output without more chaos.</p>
        </div>
        <div>
          <h3>Navigate</h3>
          <a href="#agents">Agents</a>
          <a href="#system">System</a>
          <a href="#protocols">SOPs</a>
          <a href="#contact">Contact</a>
        </div>
        <div>
          <h3>Build</h3>
          {serviceLinks.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div>
          <h3>Contact</h3>
          <a href="mailto:hello@supraintegration.ai">hello@supraintegration.ai</a>
          <a href="tel:+18018709331">801-870-9331</a>
          <span>Salt Lake City, Utah</span>
          <span>US businesses only</span>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>Supra Integration — a SupraScales company</span>
        <span>supraintegration.ai</span>
      </div>
    </footer>
  );
}
