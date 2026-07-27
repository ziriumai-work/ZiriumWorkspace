"use client";

import React, { useEffect, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ListSubheader from "@mui/material/ListSubheader";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

interface Channel {
  id: string;
  name: string;
}

interface Colleague {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface Props {
  value?: string;
  onChange: (channelId: string) => void;
}

export function SlackChannelSelect({ value, onChange }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchChannels = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const getChannels = httpsCallable(functions, "getSlackChannels");
      const result = await getChannels();
      const data = result.data as {
        channels?: Channel[];
        colleagues?: Colleague[];
        connected?: boolean;
        error?: string;
        teamName?: string;
      };

      if (!data.connected) {
        setError("Slack not connected");
      } else if (data.error) {
        setError(`Slack API Error: ${data.error}`);
      } else {
        setError("");
        setChannels(data.channels || []);
        setColleagues(data.colleagues || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch Slack channels:", err);
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  if (loading) {
    return <CircularProgress size={20} />;
  }

  if (error || (channels.length === 0 && colleagues.length === 0)) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Select size="small" disabled displayEmpty value="" sx={{ minWidth: 160, borderRadius: 2, fontSize: 13 }}>
          <MenuItem value="">{error ? error : "No Channels (Invite bot / check scopes)"}</MenuItem>
        </Select>
        <Tooltip title="Try Refreshing">
          <IconButton size="small" onClick={() => fetchChannels(true)} disabled={refreshing}>
            {refreshing ? <CircularProgress size={14} /> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            )}
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Select
          value={value || ""}
          displayEmpty
          onChange={(e) => onChange(e.target.value as string)}
          sx={{
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 500,
            "& .MuiSelect-select": { display: "flex", alignItems: "center", gap: 1 },
          }}
        >
          <MenuItem value="">
            <em style={{ color: "#888" }}>None</em>
          </MenuItem>

          {channels.length > 0 && (
            <ListSubheader sx={{ lineHeight: "28px", fontSize: 11, fontWeight: 700, color: "primary.main", bgcolor: "transparent" }}>
              📢 CHANNELS
            </ListSubheader>
          )}
          {channels.map((c) => (
            <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>
              #{c.name}
            </MenuItem>
          ))}

          {colleagues.length > 0 && (
            <ListSubheader sx={{ lineHeight: "28px", fontSize: 11, fontWeight: 700, color: "primary.main", bgcolor: "transparent", mt: 1 }}>
              👤 WORKSPACE PEOPLE
            </ListSubheader>
          )}
          {colleagues.map((u) => (
            <MenuItem key={u.id} value={u.id} sx={{ fontSize: 13, display: "flex", alignItems: "center", gap: 1 }}>
              {u.avatar ? (
                <Avatar src={u.avatar} sx={{ width: 20, height: 20 }} />
              ) : (
                <Box sx={{ width: 20, height: 20, borderRadius: "50%", bgcolor: "primary.light", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                  {u.name.charAt(0)}
                </Box>
              )}
              {u.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Tooltip title="Refresh Slack channels & people in real-time">
        <IconButton
          size="small"
          onClick={() => fetchChannels(true)}
          disabled={refreshing}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            p: 0.6,
            "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
          }}
        >
          {refreshing ? (
            <CircularProgress size={14} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
