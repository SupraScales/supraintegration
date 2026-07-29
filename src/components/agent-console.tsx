"use client";

import { useState } from "react";

const suggestedQuestions = [
  "Which leads should the team contact today?",
  "Where are we losing the most revenue?",
  "What changed compared with last month?",
  "What should the team focus on this week?",
];

export function AgentConsole({
  available,
  unavailableReason,
}: {
  available: boolean;
  unavailableReason: string;
}) {
  const [question, setQuestion] = useState("");

  return (
    <section className="agent-console">
      <div className="agent-console-status">
        <p className="product-kicker"><span aria-hidden />Hermes agent</p>
        <b>{available ? "Connected" : "Data connection required"}</b>
      </div>

      <div className="agent-conversation">
        <div className="agent-message">
          <span>System notice</span>
          <p>
            {available
              ? "Ask about the connected signals in this workspace."
              : unavailableReason}
          </p>
        </div>
      </div>

      <div className="agent-suggestions">
        {suggestedQuestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => setQuestion(suggestion)}
            disabled={!available}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="agent-input"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="agent-question">Ask about your business</label>
        <div>
          <textarea
            id="agent-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Connect a data source to activate the agent."
            disabled={!available}
          />
          <button className="product-button product-button-primary" disabled>
            Ask Hermes
          </button>
        </div>
        <p>
          Answers will cite connected sources and date ranges. The agent will not
          fill gaps with invented data.
        </p>
      </form>
    </section>
  );
}
