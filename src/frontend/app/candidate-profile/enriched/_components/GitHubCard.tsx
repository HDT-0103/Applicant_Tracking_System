import React from "react";
import { Github, ChevronDown, BookOpen, ExternalLink } from "lucide-react";
import { D, Dot, Badge } from "@/lib/shared";
import type { GithubProfile } from "../types";

// ─── GitHub Accordion Card ────────────────────────────────────────────────────
export function GitHubCard({
  expanded,
  onToggle,
  data,
  githubUsername,
}: {
  expanded: boolean;
  onToggle: () => void;
  data: GithubProfile | null;
  githubUsername: string | null;
}) {
  const getLangColor = (lang: string) => {
    const colors: Record<string, string> = {
      Python: "#3572A5",
      Go: "#00ADD8",
      TypeScript: "#3178C6",
      JavaScript: "#F7DF1E",
      Java: "#B07219",
      Rust: "#DEA584",
      C: "#555555",
    };
    return colors[lang] || "#6B7280";
  };

  const langs = data
    ? Object.entries(data.top_languages).map(([name, pct]) => ({
        name,
        pct: Math.round(pct),
        color: getLangColor(name),
      }))
    : [];

  const publicReposCount = data?.public_repos_count ?? 0;
  const semanticTags = data?.readme_content
    ? ["microservices", "kafka", "terraform", "k8s", "docker"]
        .filter((t) => data.readme_content?.toLowerCase().includes(t))
        .slice(0, 5)
    : [];

  return (
    <div
      style={{
        border: `1px solid ${D.line}`,
        borderRadius: 8,
        overflow: "visible",
        background: D.canvas,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: expanded ? `1px solid ${D.line}` : "none",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: D.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Github size={15} strokeWidth={1.5} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 1,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: D.ink }}>
              GitHub
            </span>
            <Badge color={D.mint} bg={D.mintSoft}>
              <Dot color={D.mint} />
              Connected
            </Badge>
          </div>
          <span
            style={{
              fontSize: 10.5,
              color: D.blue,
              fontFamily: D.mono,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {githubUsername
              ? `github.com/${githubUsername}`
              : "repository data unavailable"}{" "}
            <ExternalLink size={9} strokeWidth={2} color={D.blue} />
          </span>
        </div>
        <ChevronDown
          size={13}
          strokeWidth={2}
          color={D.muted}
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </div>
      {expanded && (
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            animation: "fadeSlideIn 0.2s ease both",
          }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                background: D.surface,
                border: `1px solid ${D.lineSoft}`,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: D.muted,
                  marginBottom: 4,
                }}
              >
                Public Repos Analyzed
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: D.ink,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  fontFamily: D.mono,
                }}
              >
                {publicReposCount}
              </div>
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                background: D.surface,
                border: `1px solid ${D.lineSoft}`,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: D.muted,
                  marginBottom: 6,
                }}
              >
                Top Languages
              </div>
              {langs.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  {langs.map((lang) => (
                    <div
                      key={lang.name}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: lang.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: D.sub,
                          flex: 1,
                        }}
                      >
                        {lang.name}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          color: D.muted,
                          fontFamily: D.mono,
                        }}
                      >
                        {lang.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: D.muted, lineHeight: 1.5 }}>
                  No repository language data available yet.
                </div>
              )}
            </div>
          </div>
          {langs.length > 0 && (
            <div
              style={{
                display: "flex",
                height: 5,
                borderRadius: 99,
                overflow: "hidden",
                gap: 1.5,
              }}
            >
              {langs.map((lang) => (
                <div
                  key={lang.name}
                  style={{
                    flex: lang.pct,
                    background: lang.color,
                    borderRadius: 99,
                  }}
                  title={`${lang.name}: ${lang.pct}%`}
                />
              ))}
            </div>
          )}
          <div
            style={{
              padding: "11px 13px",
              borderRadius: 6,
              background: D.blueSoft,
              border: `1px solid ${D.blueMid}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: D.blue,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 5,
                paddingLeft: 2,
              }}
            >
              <BookOpen size={10} strokeWidth={2} color={D.blue} />
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: D.blue,
                }}
              >
                Latest README.md Semantic Extraction
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: D.sub,
                lineHeight: 1.55,
                paddingLeft: 2,
              }}
            >
              {semanticTags.length > 0
                ? `Corroborated skills extracted from README: ${semanticTags.map((tag) => `#${tag}`).join(", ")}.`
                : "No README content available yet for semantic extraction."}
            </p>
            <div
              style={{
                display: "flex",
                gap: 5,
                marginTop: 7,
                flexWrap: "wrap",
                paddingLeft: 2,
              }}
            >
              {semanticTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9.5,
                    fontFamily: D.mono,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: `${D.blue}12`,
                    border: `1px solid ${D.blue}22`,
                    color: D.blue,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
