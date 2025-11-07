import Button from "@mui/joy/Button";
import { Snackbar as JoySnackbar } from "@mui/joy";
import { useCallback, useEffect, useState } from "react";
import type { ColorPaletteProp } from "@mui/joy/styles";

export function Snackbar({
  msg,
  onClose,
  show = false,
  variant = "soft",
  type = "warning",
}: {
  msg: string;
  onClose?: VoidFunction;
  show?: boolean;
  variant?: "soft" | "solid" | "outlined";
  type?: ColorPaletteProp;
}) {
  const [open, setOpen] = useState(show);

  useEffect(() => {
    setOpen(show);
  }, [show]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  return (
    <JoySnackbar
      variant={variant}
      color={type}
      open={open}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      endDecorator={
        <Button onClick={handleClose} size="md" variant="outlined">
          Close
        </Button>
      }
    >
      {msg}
    </JoySnackbar>
  );
}
