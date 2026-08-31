import type { LinkedinEducation, LinkedinExperience, TimelineItem } from "../types";

// Helper function to convert LinkedIn experiences to timeline items
export function experiencesToTimelineItems(
  experiences: LinkedinExperience[],
  educations: LinkedinEducation[],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Add work experiences
  experiences.forEach((exp, index) => {
    const startDate = exp.start_date || "";
    const endDate = exp.end_date || "Present";
    const period = `${startDate} — ${endDate}`;

    // Extract year from start date
    const yearMatch = startDate.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : "Unknown";

    items.push({
      year,
      title: exp.title,
      org: exp.company,
      period,
      type: "work",
      current: exp.is_current || !exp.end_date,
      note: exp.description || "",
      verified: true,
    });
  });

  // Add education
  educations.forEach((edu) => {
    const startDate = edu.start_date || "";
    const endDate = edu.end_date || "";
    const period = `${startDate} — ${endDate}`;

    // Extract year from start date
    const yearMatch = startDate.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : "Unknown";

    items.push({
      year,
      title: edu.degree || edu.school,
      org: edu.school,
      period,
      type: "edu",
      current: false,
      note: edu.field_of_study || "",
      verified: true,
    });
  });

  // Sort by year descending (most recent first)
  return items.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    return yearB - yearA;
  });
}
