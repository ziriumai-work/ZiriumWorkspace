"use client";

import React, { useEffect, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

interface Channel {
  id: string;
  name: string;
}

interface Props {
  value?: string;
  onChange: (channelId: string) => void;
}

export function SlackChannelSelect({ value, onChange }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchChannels = async () => {
      try {
        const getChannels = httpsCallable(functions, "getSlackChannels");
        const result = await getChannels();
        const data = result.data as { channels?: Channel[], connected?: boolean, error?: string, teamName?: string };
        
        if (mounted) {
          if (!data.connected) {
            setError("Slack not connected");
          } else if (data.error) {
            setError(`Slack API Error: ${data.error}`);
          } else if (data.channels) {
            setChannels(data.channels);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Failed to fetch Slack channels:", err);
          setError(err.message || "Failed to load");
          setLoading(false);
        }
      }
    };

    fetchChannels();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <CircularProgress size={20} />;
  }

  if (error || channels.length === 0) {
    return (
      <Select size="small" disabled displayEmpty value="" sx={{ minWidth: 160 }}>
        <MenuItem value="">{error ? error : "No Channels (Invite bot / check scopes)"}</MenuItem>
      </Select>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <Select
        value={value || ""}
        displayEmpty
        onChange={(e) => onChange(e.target.value as string)}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {channels.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            #{c.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
