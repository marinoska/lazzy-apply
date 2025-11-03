import React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Box from "@mui/joy/Box";
import type { SidebarViewProps } from "./types.js";

export function SidebarView({ state, onClose, onSignIn, onSignOut }: SidebarViewProps) {
  const { visible, loading, status, session } = state;

  return (
    <div className={`overlay${visible ? " visible" : ""}`} role="presentation" aria-hidden={visible ? "false" : "true"}>
      <Sheet className="panel" variant="soft" color="neutral">
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography level="title-lg" sx={{ fontWeight: 600 }}>
                LazyApplyAgent
              </Typography>
            </Box>
            <IconButton
              aria-label="Close"
              variant="plain"
              color="neutral"
              size="sm"
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 0 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                  fill="currentColor"
                />
              </svg>
            </IconButton>
          </Stack>

          {status ? (
            <Sheet
              variant="soft"
              color={status.startsWith("Failed") ? "danger" : "neutral"}
              sx={{
                borderRadius: "md",
                px: 1.5,
                py: 1,
                fontSize: "0.875rem"
              }}
            >
              {status}
            </Sheet>
          ) : null}

          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size="sm" determinate={false} />
              <Typography level="body-sm" color="neutral">
                Working…
              </Typography>
            </Stack>
          ) : null}

          {!session && !loading ? (
            <Typography level="body-md" color="neutral">
              You&apos;re not signed in.
            </Typography>
          ) : null}

          {session ? (
            <Sheet variant="plain" sx={{ borderRadius: "md", px: 1.5, py: 1 }}>
              <Typography level="body-sm" color="success" sx={{ fontWeight: 600, mb: 0.5 }}>
                Signed in
              </Typography>
              <Typography level="title-sm">{session.user?.email ?? "unknown"}</Typography>
            </Sheet>
          ) : null}

          <Divider sx={{ my: 0.5 }} />

          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="solid"
              color="primary"
              size="md"
              onClick={session ? onSignOut : onSignIn}
              disabled={loading}
            >
              {session ? "Sign out" : "Sign in with Google"}
            </Button>
          </Stack>
        </Stack>
      </Sheet>
    </div>
  );
}
