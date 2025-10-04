#!/usr/bin/env python3
import cv2
import sys
import json

def scan_qr_code(image_path):
    """Scan QR code using OpenCV"""
    try:
        # Load the image
        image = cv2.imread(image_path)
        
        if image is None:
            return {"success": False, "error": "Could not read image"}
        
        # Create QRCodeDetector
        qr_detector = cv2.QRCodeDetector()
        
        # Detect and decode QR code
        decoded_data, bbox, rectified_image = qr_detector.detectAndDecode(image)
        
        if decoded_data:
            result = {
                "success": True,
                "data": decoded_data,
                "bbox": bbox.tolist() if bbox is not None else None
            }
            return result
        else:
            return {"success": False, "error": "No QR code detected"}
    
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    result = scan_qr_code(image_path)
    print(json.dumps(result))
