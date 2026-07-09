// Seed data: the MARK Architects website delivery timeline (5 weeks).
// Structured as Week -> Phase -> Tasks, then flattened into TaskItem[] for the
// project's embedded task table. Used by the one-click sample action on the
// Projects page.

import {
  OPTION_COLOR_CYCLE,
  type DbColumn,
  type DbRow,
  type SelectOption,
} from "@/lib/types";
import { defaultColumns } from "@/lib/db";

const uuid = () => crypto.randomUUID();

export const MARK_PROJECT_TITLE = "MARK Architecture Website";

export const MARK_PROJECT_DESCRIPTION =
  "5-week delivery timeline for the MARK Architects website — design, core " +
  "pages, e-commerce store, admin dashboard, engagement tools, and launch. " +
  "Each phase pulls work forward to absorb slack that would otherwise sit idle.";

interface WeekPlan {
  week: string;
  phases: { phase: string; tasks: string[] }[];
}

export const MARK_TIMELINE: WeekPlan[] = [
  {
    week: "Week 1",
    phases: [
      {
        phase: "1.1 Project Kickoff & Asset Collection",
        tasks: [
          "Kick-off meeting — confirm scope, service list, and point-of-contact",
          "Collect client assets: logo, brand photography, and service descriptions",
          "Receive and verify 3D house model file from MARK Architects (.glb / .gltf)",
          "Confirm final service names: Building/Home Review, Map Redesign, Interior Design, Construction Cost Estimate, Full House Plan, Consultation",
          "Finalise information architecture and sitemap",
        ],
      },
      {
        phase: "1.2 Brand & Design System",
        tasks: [
          "Apply brand colour palette: Black, Grey, Red, White",
          "Integrate client logo across all design mockups",
          "Establish typography and component system (buttons, cards, forms, icons)",
        ],
      },
      {
        phase: "1.3 UI Design — Homepage & Navigation",
        tasks: [
          "Design full-screen hero section with firm name, tagline, and primary CTA",
          "Design fixed navigation bar (Portfolio, Services, About, Contact)",
          "Design featured projects section (3-column card grid with moody photography)",
          "Design services preview section (dark-themed cards with icons)",
          "Client sign-off on homepage design",
        ],
      },
      {
        phase: "1.4 UI Design — Portfolio & Services",
        tasks: [
          "Design portfolio page layout with category filter tabs",
          "Design service card pop-up overlay (description, deliverables, price indicator, CTA)",
          "Design full individual service page layout",
          "Design service packages comparison layout (Basic / Standard / Premium tiers)",
          "Client sign-off on portfolio and services design",
        ],
      },
      {
        phase: "1.5 Development Groundwork (from Day 3 — pulled forward from Week 2)",
        tasks: [
          "Set up project environment, version control repository, and deployment pipeline",
          "Design and initialise database schema (projects, services, packages, products, bookings)",
          "Build page routing structure and fixed navigation bar in code",
          "Develop homepage hero section layout and header (3D model integration deferred to Week 2 until asset is confirmed)",
        ],
      },
    ],
  },
  {
    week: "Week 2",
    phases: [
      {
        phase: "2.1 Homepage",
        tasks: [
          "Integrate interactive 3D house model into hero section (rotate/explore in browser)",
          "Develop featured projects preview section (3-column card grid, photography, links)",
          "Develop services preview section (dark cards, icons, descriptions)",
        ],
      },
      {
        phase: "2.2 Portfolio",
        tasks: [
          "Build portfolio page with dynamic category filtering (Residential, Commercial, Interior Design, Exterior Design, Landscape, Renovation)",
          "Connect portfolio to database (title, description, location, date, photography, 3D renders)",
          "Build individual project detail page",
        ],
      },
      {
        phase: "2.3 Services",
        tasks: [
          "Build service card pop-up overlays (description, deliverables, starting price, View Full Details and Book buttons)",
          "Build individual full-page for each of the six services: Building/Home Review, Map Redesign, Interior Design, Construction Cost Estimate, Full House Plan, Consultation",
          "Enable 3D model sharing on Interior Design service page",
          "Build service packages section per service (tier comparison, PKR pricing, Get Started buttons)",
          "Connect service packages to database for admin editability",
        ],
      },
    ],
  },
  {
    week: "Week 3",
    phases: [
      {
        phase: "3.1 E-Commerce Store",
        tasks: [
          "Build product listing grid (name, photo, PKR price, stock status, Add to Cart)",
          "Build product detail pages (image gallery, viewing-angle thumbnails, specifications, Add to Cart)",
          "Build shopping cart and secure checkout flow",
          "Configure automated payment confirmation email to customer (order summary, PKR total, unique reference, dispatch timeline)",
          "Configure order notification email to MARK Architects team on each successful payment",
        ],
      },
      {
        phase: "3.2 Admin Dashboard",
        tasks: [
          "Build secure admin portal with login authentication",
          "Portfolio management: add, edit, delete projects with status tracking",
          "Services management: add, edit, delete services and service categories",
          "Packages management: add, edit, delete package tiers (name, price, inclusions) per service",
          "Products management: add, edit, delete products; manage inventory and PKR pricing",
          "3D image and render upload management for projects and products",
          "Homepage and company information editor (imagery, tagline, contact details, social links)",
          "Consultation bookings and client inquiry inbox view",
          "E-commerce order management (payment status, order details, customer information)",
          "Chatbot knowledge base and FAQ editor",
          "Basic analytics overview: page visits, inquiry count, top-performing services",
        ],
      },
      {
        phase: "3.3 Contact Page (pulled forward from Week 4 — low complexity, fits here)",
        tasks: [
          "Build contact form with direct inbox delivery to firm",
          "Add office address, phone, email, and business hours",
          "Embed Google Maps location",
          "Add social media profile links",
        ],
      },
    ],
  },
  {
    week: "Week 4",
    phases: [
      {
        phase: "4.1 AI-Powered Chatbot",
        tasks: [
          "Integrate floating chatbot widget across all pages (fixed position, always visible)",
          "Configure knowledge base: services, pricing tiers, FAQs, consultation process",
          "Set up visitor inquiry capture (name, phone number, project type) with team routing",
          "Configure booking prompts when visitor intent is detected",
          "Enable after-hours autonomous operation (no manual monitoring required)",
        ],
      },
      {
        phase: "4.2 Consultation & Meeting Booking",
        tasks: [
          "Build consultation request form (Full Name, Phone, Email, Project Type, Message)",
          "Integrate calendar with available date and time-slot selection",
          "Configure automated booking confirmation email to client upon submission",
          "Apply premium design and interaction polish to consultation section (highest UI priority on site)",
        ],
      },
      {
        phase: "4.3 SEO, Security & Performance Optimisation",
        tasks: [
          "Configure clean, descriptive URL structure for all pages and portfolio projects",
          "Write and apply meta titles and descriptions for all pages",
          "Set structured heading hierarchy, image alt tags, and SEO file naming",
          "Apply local business and professional services schema markup",
          "Activate SSL/TLS certificate across the entire site",
          "Configure spam and injection protection on all form submissions",
          "Enable automatic image compression to WebP, lazy loading, CSS/JS minification, and server-level caching",
          "Performance audit — target under 3-second initial page load on standard connection",
        ],
      },
    ],
  },
  {
    week: "Week 5",
    phases: [
      {
        phase: "5.1 Quality Assurance",
        tasks: [
          "Cross-device testing: Mobile, Tablet, Laptop, Desktop",
          "Cross-browser testing: Chrome, Safari, Firefox, Edge",
          "Full user flow testing: portfolio browsing, service pop-ups and pages, package selection, checkout, chatbot, consultation booking",
          "Admin dashboard testing: all add/edit/delete operations, order management, content updates, analytics",
          "3D model and render loading validation across devices",
        ],
      },
      {
        phase: "5.2 Bug Fixing & Polish",
        tasks: [
          "Resolve all defects identified during QA",
          "Final visual and interaction review across all pages",
          "Performance re-audit after bug fixes — confirm sub-3-second load targets are met",
        ],
      },
      {
        phase: "5.3 Content Upload & Launch Preparation",
        tasks: [
          "Support MARK Architects team in uploading portfolio projects, service content, and product listings via Admin Dashboard",
          "Final client review and written sign-off",
          "Configure automated backups",
          "Deploy website to live hosting",
        ],
      },
      {
        phase: "5.4 Handover & Post-Launch",
        tasks: [
          "Admin dashboard walkthrough session for MARK Architects team",
          "Provide usage guidance for portfolio, services, packages, products, orders, chatbot, and bookings",
          "45-day free maintenance period begins from launch date",
        ],
      },
    ],
  },
];

// Build the Notion-style database (columns + rows) for the MARK timeline:
// columns Name · Phase · Week (select) · Status, with a Week option per week and
// every row starting at status "todo".
export function buildMarkDatabase(): { columns: DbColumn[]; rows: DbRow[] } {
  const columns = defaultColumns();
  const weekCol = columns.find((c) => c.id === "week")!;

  // One coloured Week option per distinct week, in order.
  const weekOptions: SelectOption[] = MARK_TIMELINE.map((w, i) => ({
    id: uuid(),
    label: w.week,
    color: OPTION_COLOR_CYCLE[i % OPTION_COLOR_CYCLE.length],
  }));
  weekCol.options = weekOptions;
  const weekIdByLabel = new Map(weekOptions.map((o) => [o.label, o.id]));

  const rows: DbRow[] = [];
  let order = 0;
  for (const { week, phases } of MARK_TIMELINE) {
    for (const { phase, tasks } of phases) {
      for (const task of tasks) {
        rows.push({
          id: uuid(),
          order: order++,
          cells: {
            name: task,
            phase,
            week: weekIdByLabel.get(week) ?? null,
            status: "todo",
          },
        });
      }
    }
  }

  return { columns, rows };
}
