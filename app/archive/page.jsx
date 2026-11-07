// /app/archive/page.jsx

"use client";

import React, { useState, useEffect } from 'react';
import { STYLE_CONFIG } from '../config/styles';

// --- CONFIGURATION ---
const CLOUD_NAME = "douftcirs";
const GALLERY_FOLDER = "dishes_archive";

const buildCloudinaryUrl = (publicId) => {
  const transformations = 'w_400,f_auto,q_auto:eco';
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformations}/${publicId}`;
};

export default function ArchivePage() {
  const [ceramics, setCeramics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCeramics = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = `/api/ceramics?folder=${GALLERY_FOLDER}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            let errorDetails = `Status: ${response.status}.`;
            try {
                const errorBody = await response.json();
                errorDetails += ` Error: ${errorBody.error || 'Server error.'}`;
            } catch (e) {
                errorDetails += ' API Route failed or returned bad format.';
            }
            throw new Error(errorDetails);
        }

        const data = await response.json();
        setCeramics(data.resources);

      } catch (err) {
        console.error("Fetch Error:", err);
        setError(`Could not load : ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCeramics();
  }, []);

  const elementClasses = STYLE_CONFIG.navLinkClasses;

  return (
    <div className="min-h-screen text-2xl font-sans bg-[#ff0000]">
      <header
        className="py-6"
        style={{
          borderBottom: STYLE_CONFIG.borderStyle.borderTop,
          color: STYLE_CONFIG.brandColor
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className={elementClasses}>archive</h1>
          <a href="/" className={elementClasses} aria-label="Back to homepage">&#8592;</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-4" style={{ color: STYLE_CONFIG.brandColor }}>
        {loading && <div className="text-center p-8">Loading stuff...</div>}
        {error && <div className="text-red-500 text-center p-4">{error}</div>}
        {!loading && !error && ceramics.length === 0 && (
            <div className="text-center p-8">No artwork found in this folder.</div>
        )}

        {!loading && ceramics.length > 0 && (
          <div className="flex flex-wrap">
            {ceramics.map((ceramic) => (
              // Each item takes 1/2 of the width on small screens, 1/3 on medium/large
              <div
                key={ceramic.public_id}
                className="w-1/2 sm:w-1/2 md:w-1/3"
                style={{ border: `1px solid ${STYLE_CONFIG.brandColor}` }}
              >
                <div className="w-full h-full relative">
                  <img
                    src={buildCloudinaryUrl(ceramic.public_id)}
                    alt={ceramic.context?.alt || "Archived ceramics artwork"}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
