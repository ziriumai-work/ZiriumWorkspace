"use client";

// Project-level developer assignment. Assign one developer to the whole project
// to start; add more or remove someone if the team changes (e.g. a developer
// leaves mid-project and is replaced). The first in the list is the lead.
// People come from the shared roster (Team page).

import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import type { Developer } from "@/lib/data/types";

export function ProjectDevelopers({
  developerIds,
  roster,
  onChange,
  editable = true,
}: {
  developerIds: string[];
  roster: Developer[];
  onChange: (ids: string[]) => void;
  editable?: boolean;
}) {
  const byId = new Map(roster.map((d) => [d.id, d]));
  const assigned = developerIds
    .map((id) => byId.get(id))
    .filter((d): d is Developer => Boolean(d));
  const available = roster.filter((d) => !developerIds.includes(d.id));

  function add(id: string) {
    if (id && !developerIds.includes(id)) onChange([...developerIds, id]);
  }
  function remove(id: string) {
    onChange(developerIds.filter((x) => x !== id));
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
      {assigned.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No developer assigned yet.
        </Typography>
      )}

      {assigned.map((d, i) => (
        <Chip
          key={d.id}
          variant="outlined"
          avatar={
            <Avatar
              sx={{
                bgcolor: "accentSoft",
                color: "primary.main",
                fontWeight: 600,
              }}
            >
              {d.name.charAt(0).toUpperCase()}
            </Avatar>
          }
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {d.name}
              </Typography>
              {i === 0 && (
                <Box
                  component="span"
                  sx={{
                    borderRadius: 0.5,
                    bgcolor: "accentSoft",
                    color: "primary.main",
                    px: 0.5,
                    py: 0.1,
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  Lead
                </Box>
              )}
              {d.role && (
                <Typography variant="caption" color="text.secondary">
                  · {d.role}
                </Typography>
              )}
            </Box>
          }
          onDelete={editable ? () => remove(d.id) : undefined}
          sx={{ height: 32, borderRadius: 999, bgcolor: "surface" }}
        />
      ))}

      {/* Add control */}
      {!editable ? null : roster.length === 0 ? (
        <Button
          component={Link}
          href="/team"
          variant="outlined"
          color="inherit"
          sx={{
            borderStyle: "dashed",
            borderColor: "divider",
            color: "text.secondary",
            fontSize: 12,
          }}
        >
          + Add developers on the Team page
        </Button>
      ) : available.length > 0 ? (
        <Select
          value=""
          onChange={(e) => add(e.target.value)}
          displayEmpty
          variant="outlined"
          sx={{
            fontSize: 12,
            color: "text.secondary",
            "& .MuiOutlinedInput-notchedOutline": {
              borderStyle: "dashed",
            },
            "& .MuiSelect-select": { py: 0.75 },
          }}
        >
          <MenuItem value="">
            {assigned.length === 0 ? "+ Assign developer" : "+ Add developer"}
          </MenuItem>
          {available.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
              {d.role ? ` (${d.role})` : ""}
            </MenuItem>
          ))}
        </Select>
      ) : null}
    </Box>
  );
}
