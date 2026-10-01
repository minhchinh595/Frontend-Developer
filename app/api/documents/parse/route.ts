import { NextResponse } from "next/server";
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export async function POST(request: Request) {
  try {
    // Nhận FormData từ frontend
    const formData = await request.formData();

    const file = formData.get("file");

    // Kiểm tra có file hay không
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "No file was uploaded.",
        },
        {
          status: 400,
        }
      );
    }

    // Chỉ cho phép PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          error: "Only PDF files are supported.",
        },
        {
          status: 400,
        }
      );
    }

    // Giới hạn 4 MB
    // Giữ thấp hơn giới hạn request của Vercel để tránh lỗi 413
    const maxFileSize = 4 * 1024 * 1024;

    if (file.size > maxFileSize) {
      return NextResponse.json(
        {
          error:
            "File size must be 4 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    // Chuyển File thành Buffer
    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    // Tạo PDF parser
    const parser = new PDFParse({
      data: buffer,
      CanvasFactory,
    });

    // Đọc text trong PDF
    const result = await parser.getText();

    // Giải phóng tài nguyên
    await parser.destroy();

    // Trả kết quả về frontend
    return NextResponse.json({
      success: true,
      fileName: file.name,
      pageCount: result.total,
      text: result.text,
    });
  } catch (error) {
    console.error("PDF parsing error:", error);

    return NextResponse.json(
      {
        error: "Failed to read the PDF file.",
      },
      {
        status: 500,
      }
    );
  }
}