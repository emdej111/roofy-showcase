# Roofy

> A modern long-term apartment rental platform for the Croatian market — built to replace fragmented classifieds and Facebook groups with a centralized, reliable rental experience.

![Tech Stack](https://img.shields.io/badge/React-TypeScript-blue) ![Supabase](https://img.shields.io/badge/Database-Supabase-green) ![Capacitor](https://img.shields.io/badge/Mobile-Capacitor-orange)

---

## Problem

The Croatian rental market has no centralized platform. Landlords and tenants rely on generic classifieds (Njuškalo, Plavi Oglasnik) and Facebook groups with no real-time availability status, no filtering, no map-based search and no security.

## Solution

Roofy is a full-stack rental platform with two distinct user roles, map-based property discovery, and a structured listing lifecycle, bringing the Croatian rental market into the modern era.

---

## Features

### For Landlords
- Create and manage property listings with photos, pricing, and detailed amenities
- Place a pin on an interactive map for precise location
- Manage listing status: Available / Reserved / Rented
- Receive and respond to tenant inquiries

### For Tenants
- Search apartments by city, price range, size, and amenities
- Map-based search with radius, rectangle, and freehand polygon area selection
- Save favourite listings
- Contact landlords directly through the platform

### Platform
- Two-role authentication system (Landlord / Tenant)
- GDPR-compliant data handling
- SMS phone verification (OTP)
- Listing moderation system
- Mobile-ready via Capacitor (iOS / Android)

---

## Tech Stack

| Layer          | Technology                |
|---|------------|---------------------------|
| Frontend       | React + TypeScript + Vite |
| Styling        | Tailwind CSS + shadcn/ui  |
| Database       | Supabase (PostgreSQL)     |
| Authentication | Supabase Auth             |
| Maps           | Leaflet.js                |
| Mobile         | Capacitor                 |
| Payments       | Stripe (planned)          |

---

## Project Structure

src/
├── components/ # Reusable UI components
├── pages/ # Route-level page components
├── hooks/ # Custom React hooks
├── lib/ # Utilities and helpers
└── integrations/ # Supabase client and types

supabase/
└── migrations/ # Database schema and migrations
