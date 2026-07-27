"use client";

// Project-level developer assignment component.

import { useState } from "react";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CheckIcon from "@mui/icons-material/Check";
import type { Developer } from "@/lib/data/types";

export function ProjectDevelopers({
  developerIds,
  roster,
  onChange,
  editable = true,
  projectRoles,
  onRoleChange,
}: {
  developerIds: string[];
  roster: Developer[];
  onChange: (ids: string[]) => void;
  editable?: boolean;
  projectRoles?: Record<string, string>;
  onRoleChange?: (developerId: string, role: string) => void;
}) {
  const byId = new Map(roster.map((d) => [d.id, d]));
  const assigned = developerIds
    .map((id) => byId.get(id))
    .filter((d): d is Developer => Boolean(d));
  const available = roster.filter((d) => !developerIds.includes(d.id));

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editingDevId, setEditingDevId] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState("");

  function add(id: string) {
    if (id && !developerIds.includes(id)) onChange([...developerIds, id]);
  }
  function remove(id: string) {
    onChange(developerIds.filter((x) => x !== id));
  }

  function handleOpenRole(e: React.MouseEvent<HTMLElement>, devId: string) {
    if (!editable) return;
    setAnchorEl(e.currentTarget);
    setEditingDevId(devId);
    setEditRoleValue(projectRoles?.[devId] || "");
  }

  function handleCloseRole() {
    setAnchorEl(null);
    setEditingDevId(null);
  }

  function handleSaveRole() {
    if (editingDevId && onRoleChange) {
      onRoleChange(editingDevId, editRoleValue.trim());
    }
    handleCloseRole();
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
      {assigned.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No developer assigned yet.
        </Typography>
      )}

      {assigned.map((d) => (
        <Chip
          key={d.id}
          variant="outlined"
          onClick={editable ? (e) => handleOpenRole(e, d.id) : undefined}
          avatar={
            <Avatar
              src={d.photoURL || undefined}
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
              {projectRoles?.[d.id] && (
                <Box
                  component="span"
                  sx={{
                    borderRadius: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    px: 1,
                    py: 0.25,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Project Role: {projectRoles[d.id]}
                </Box>
              )}
            </Box>
          }
          onDelete={editable ? () => remove(d.id) : undefined}
          sx={{
            height: "auto",
            py: 0.5,
            px: 0.5,
            borderRadius: 999,
            bgcolor: "surface",
            "& .MuiChip-label": { py: 0.5, px: 1 },
          }}
        />
      ))}

      {/* Add control */}
      {!editable ? null : roster.length === 0 ? (
        <Button
          component={Link}
          href="/employees"
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

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleCloseRole}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <Box sx={{ p: 2, display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Role (e.g. QA, Lead)"
            value={editRoleValue}
            onChange={(e) => setEditRoleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveRole();
            }}
            autoFocus
          />
          <IconButton color="primary" onClick={handleSaveRole}>
            <CheckIcon />
          </IconButton>
        </Box>
      </Popover>
    </Box>
  );
}
