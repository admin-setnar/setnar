# DESIGN_SYSTEM.md

> Design System
> Version: 1.0
> Status: Active
> Product: SETNAR

---

# Purpose

This document defines the visual language, interaction principles, accessibility guidelines and reusable components of SETNAR.

The Design System exists to create a consistent experience across every screen, feature and future product.

Every interface should feel like it belongs to the same ecosystem.

---

# Design Philosophy

SETNAR is not a marketing website.

SETNAR is a professional work tool.

Every interface decision must increase clarity.

Never design to impress.

Design to reduce cognitive load.

Users should immediately understand:

- where they are
- what they can do
- what happens next

---

# Core Principles

## Simplicity

Every screen should solve one problem.

Avoid unnecessary elements.

---

## Clarity

Every action should be obvious.

Users should never wonder:

"What should I click?"

---

## Consistency

The same action should always look and behave the same way.

Never reinvent components.

---

## Accessibility

Accessibility is mandatory.

Not optional.

Every component must be usable by everyone.

---

## Performance

Interfaces should feel instantaneous.

Animations must support usability.

Never decoration.

---

# Design Personality

SETNAR should feel:

Professional

Reliable

Minimal

Modern

Clean

Fast

Confident

Never:

Playful

Childish

Flashy

Overloaded

Gamified

---

# Design Inspiration

SETNAR draws inspiration from:

- Stripe
- Linear
- Vercel
- Notion
- GitHub
- Raycast

The goal is not imitation.

The goal is adopting their principles.

---

# Visual Identity

Visual communication should emphasize:

Whitespace

Typography

Alignment

Hierarchy

Consistency

Instead of:

Gradients

Heavy shadows

Large illustrations

Decorative effects

---

# Color Philosophy

Color communicates meaning.

Never decoration.

Every color must have a purpose.

Primary

Represents actions.

Secondary

Represents supporting information.

Success

Positive confirmation.

Warning

Requires attention.

Danger

Critical action or error.

Neutral

Everything else.

Avoid excessive color usage.

Interfaces should remain visually calm.

---

# Typography

Typography is the primary visual element.

Preferred font:

Plus Jakarta Sans

Fallback:

System UI

Hierarchy

Display

Heading

Title

Subtitle

Body

Caption

Typography should communicate importance.

Never rely on color alone.

---

# Spacing

Spacing defines structure.

Use an 8-point grid.

Allowed spacing values:

4

8

12

16

24

32

40

48

64

96

Never use arbitrary spacing.

---

# Border Radius

Use subtle rounding.

Small

Medium

Large

Extra Large

Avoid exaggerated rounded corners.

Professional software should feel precise.

---

# Shadows

Use shadows sparingly.

Purpose:

Separate layers.

Never decorate components.

Prefer borders over shadows.

---

# Icons

Use a single icon library.

Recommended:

Lucide

Icons should:

Be consistent

Be lightweight

Never replace text

Icons support labels.

They do not replace labels.

---

# Layout

Application Layout

Sidebar

↓

Header

↓

Content

↓

Footer (optional)

Content width should maximize readability.

Avoid stretching interfaces across ultra-wide monitors.

---

# Responsive Design

Mobile First.

Breakpoints should prioritize:

Mobile

Tablet

Desktop

Large Desktop

Every feature must work on every device.

---

# Grid System

Use CSS Grid whenever appropriate.

Use Flexbox for alignment.

Avoid deeply nested layouts.

---

# Component Philosophy

Components are reusable building blocks.

Every component must be:

Composable

Reusable

Accessible

Predictable

Documented

---

# Core Components

Buttons

Inputs

Textarea

Checkbox

Radio

Switch

Select

Badge

Avatar

Card

Modal

Drawer

Dropdown

Tabs

Tooltip

Toast

Dialog

Table

Pagination

Breadcrumb

Empty State

Skeleton

Loading Indicator

Progress

QRCode

Charts

Every component should have only one responsibility.

---

# Buttons

Primary

Main action.

Secondary

Alternative action.

Ghost

Low emphasis.

Danger

Destructive action.

Never create unnecessary button variants.

---

# Forms

Forms should be simple.

Only request required information.

Every field must include:

Label

Validation

Helpful feedback

Errors should explain how to recover.

---

# Tables

Tables exist for management.

Not presentation.

Support:

Sorting

Filtering

Pagination

Selection

Responsive behavior

---

# Empty States

Every empty state should answer:

What happened?

Why?

What should the user do next?

Empty states should encourage action.

Never leave blank screens.

---

# Loading States

Never freeze interfaces.

Every async action must display progress.

Preferred:

Skeletons

Secondary:

Spinners

Avoid loading screens.

---

# Feedback

Every user action requires feedback.

Success

Warning

Error

Loading

Feedback should be immediate.

---

# Notifications

Notifications should be:

Short

Actionable

Non-intrusive

Avoid modal dialogs unless absolutely necessary.

---

# Motion

Motion supports understanding.

Never entertainment.

Animations should:

Explain transitions

Reduce confusion

Guide attention

Maximum duration:

300ms

Prefer subtle fades and movement.

Avoid bouncing effects.

---

# Data Visualization

Charts should prioritize readability.

Minimal grid lines.

Minimal colors.

Clear labels.

Readable legends.

Never use 3D charts.

Never distort data.

---

# QR Code Component

QR Codes are a core product feature.

Every QR Code component must support:

Download

Copy Link

Regenerate

Preview

Responsive sizing

---

# Commercial Page Components

Commercial Pages should contain only:

Representative

Photo

Description

Products

Call-to-Action

WhatsApp Button

Contact Information

No distractions.

No unnecessary navigation.

The page exists to convert visitors into conversations.

---

# Accessibility

Minimum standard:

WCAG AA

Requirements:

Keyboard navigation

Focus indicators

Screen reader support

Contrast compliance

Semantic HTML

ARIA only when necessary.

---

# Dark Mode

Dark Mode is supported.

Themes:

Light

Dark

System

All components must behave consistently across themes.

---

# Performance

Every component should:

Lazy load when appropriate.

Avoid unnecessary renders.

Avoid layout shift.

Avoid blocking rendering.

---

# Design Tokens

Every visual value must be tokenized.

Examples:

Colors

Spacing

Typography

Radius

Shadow

Border

Opacity

Transitions

Never hardcode visual values.

---

# Component Documentation

Every reusable component must include:

Purpose

Usage

Properties

Accessibility notes

Examples

Known limitations

---

# Future Evolution

The Design System should support future modules without redesign.

Examples:

CRM

Analytics

Campaigns

AI

Marketplace

White Label

Consistency must survive product growth.

---

# Final Principle

Users should notice how easy SETNAR is to use.

They should never notice the Design System itself.

Great design becomes invisible.

It simply helps people accomplish their work.