import { useState, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface ImageUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (croppedImageBlob: Blob) => Promise<void>;
}

// Extract canvas helper
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export function ImageUploadModal({
  open,
  onClose,
  onSave,
}: ImageUploadModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file.");
        return;
      }
      
      // Validate size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB.");
        return;
      }
      
      setError("");
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result?.toString() || null);
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    
    setLoading(true);
    setError("");
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error("Failed to crop image.");
      await onSave(croppedBlob);
      handleClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save image.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Update Profile Photo</Typography>
        <IconButton onClick={handleClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", minHeight: 350 }}>
        {!imageSrc ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 3,
              p: 4,
              textAlign: "center"
            }}
          >
            <Box sx={{ p: 2, borderRadius: "50%", bgcolor: "accentSoft", color: "primary.main" }}>
              <PhotoCameraIcon fontSize="large" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
                Upload your photo
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Supports JPG, PNG, WEBP. Max 5MB.
              </Typography>
              <input
                type="file"
                accept="image/*"
                hidden
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Image
              </Button>
            </Box>
            {error && (
              <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
            <Box sx={{ position: "relative", width: "100%", height: 300, bgcolor: "#333", borderRadius: 2, overflow: "hidden" }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Zoom</Typography>
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e, val) => setZoom(val as number)}
              />
            </Box>
            {error && (
              <Typography variant="body2" color="error.main">
                {error}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        {imageSrc ? (
          <>
            <Button onClick={() => setImageSrc(null)} color="inherit" disabled={loading}>
              Back
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              Save Profile Photo
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
