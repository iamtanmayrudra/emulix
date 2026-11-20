# Device Lab UI — Implementation Master Plan

## 1. Project Overview

Build a component-based device-testing interface in the existing Next.js application, using the supplied screenshot as the primary visual reference.

The page should resemble a cloud device-testing workspace with:
- A slim vertical navigation rail.
- A promotional banner.
- A browser-style URL toolbar.
- Platform and operating-system navigation.
- Searchable, filterable device listings.
- A device preview that changes when a device is selected.
- Favorites, recent devices, access-request states, and a support widget.

**Important scope boundary:** this plan covers the UI and client-side demo interactions. It does not create real cloud devices, remote sessions, or browser automation unless those integrations already exist or are implemented separately.

## 2. Goals

1. Match the reference screenshot's overall layout, density, spacing, colors, and visual hierarchy.
2. Build the page from small, reusable React components.
3. Keep device metadata in a central typed registry rather than duplicating it in JSX.
4. Update the device preview immediately when the selected device changes.
5. Use genuine, appropriately licensed device-frame assets where available, with SVG/CSS fallbacks.
6. Preserve the current project's conventions and avoid unrelated changes.
7. Deliver a responsive, accessible, tested implementation.

## 3. Inspect Before Implementing

Before editing files, inspect:
- `package.json` and available scripts.
- Whether the app uses Next.js App Router or Pages Router.
- Existing route structure and shared layouts.
- React and TypeScript versions.
- Tailwind CSS version and configuration.
- Existing UI, icon, and component libraries.
- Current asset directories and available device images.
- Existing lint, type-check, and build commands.

Then choose the appropriate route. Prefer an existing page designated for this feature. If none exists, create `/device-lab`.

Do not replace project configuration, remove existing dependencies, or refactor unrelated features without a clear need.

## 4. Technology and Conventions

- Next.js using the routing architecture already present.
- React functional components and hooks.
- TypeScript when already used by the project; otherwise follow its existing conventions.
- Tailwind CSS using the installed version and current design tokens.
- Semantic HTML and accessible interactive controls.
- Reuse the installed icon library where possible.
- Keep UI, data, types, and asset mapping separate.
- Use client components only where interactive state requires them.
- Avoid unnecessary dependencies.

## 5. Page Layout and Visual Direction

Use the screenshot as the visual source of truth. Match its proportions and compact desktop layout as closely as practical.

### 5.1 Navigation rail

- Narrow, full-height rail on the left.
- White or near-white background.
- Vertically stacked icon-only navigation controls.
- Subtle separators and muted inactive icons.
- Blue active indicator and clear hover/focus states.
- Tooltips or accessible labels for icon-only controls.
- Working collapse/expand behavior where appropriate.

### 5.2 Main workspace

- Fill the viewport area to the right of the navigation rail.
- Use a soft blurred abstract background behind the workspace panel.
- Place a large white workspace panel centrally, respecting available viewport space.
- Use restrained borders, compact typography, small corner radii, and subtle shadows.
- Prevent the page from overflowing horizontally.
- Make the panel and its internal sections scroll appropriately on smaller screens.

### 5.3 Promotional banner

- Compact horizontal banner at the top of the workspace.
- Small icon, short promotional message, and green CTA button.
- Keep copy and action configurable.
- The CTA should perform a meaningful demo action or open a configured destination; do not make it appear integrated with a real service when it is not.

### 5.4 Browser toolbar

- URL/address input with a browser/globe icon.
- Editable URL value.
- Star/favorite action and extensions action.
- Consistent border, spacing, and typography.
- Do not claim that the URL is being remotely opened unless a real browser integration exists.

### 5.5 Device-selection workspace

Create a compact multi-panel region containing:
1. Platform/category sidebar.
2. OS-version navigation where relevant.
3. Searchable device list.
4. Device preview area or selection state.

The reference image has a category list on the left and a dense, multi-column device list to its right. Preserve that compact feel on desktop.

### 5.6 Device categories

Support these categories:
- Favorites
- Recent devices or recent tests
- iOS
- Android
- Windows
- macOS

Provide configurable OS-version lists where relevant. Windows examples may include 11, 10, 8.1, 8, 7, and XP. Only show device/OS combinations that exist in the local registry; label sample inventory as demo data.

### 5.7 Device list item

Each device item may include:
- Model name.
- Platform/OS version.
- Device type icon or local thumbnail.
- Favorite toggle.
- Selected state.
- Hover and keyboard-focus state.
- Optional “New” badge.
- Availability/access state only when supported by the data.

Provide a clear empty state when search or filters return no devices.

## 6. Device Data Model

Keep a central typed device registry, adapted to existing project conventions.

Example TypeScript model:

```ts
export type DevicePlatform = "ios" | "android" | "windows" | "macos";
export type DeviceCategory = "phone" | "tablet" | "desktop" | "laptop";
export type DeviceStatus = "available" | "restricted" | "offline";

export interface Device {
  id: string;
  name: string;
  manufacturer: string;
  platform: DevicePlatform;
  osVersion: string;
  category: DeviceCategory;
  width: number;
  height: number;
  pixelRatio?: number;
  frameImage?: string;
  screenImage?: string;
  thumbnailImage?: string;
  orientation?: "portrait" | "landscape";
  status?: DeviceStatus;
  isNew?: boolean;
}
```

Requirements:
- Give each device a stable unique ID.
- Keep metadata in a single registry.
- Derive platform lists, OS filters, counts, and device results from the registry.
- Clearly mark illustrative inventory as demo data.
- Do not fabricate live availability or imply a physical device is connected.
- Keep frame and screen assets optional so missing assets can use a fallback.

## 7. Dynamic Device Preview — Critical Requirement

When a user selects a device, the preview must update from the selected device record.

Examples:
- iPhone selection → appropriate phone frame and screen silhouette.
- iPad selection → tablet frame with matching proportions.
- Android selection → appropriate Android frame.
- Windows desktop selection → monitor frame.
- Windows laptop selection → laptop frame.
- Mac selection → corresponding laptop or desktop frame.

### 7.1 Asset strategy

Preferred order:
1. Genuine model-specific PNG/SVG frame with permission for use.
2. Reusable local frame asset for the correct device family.
3. Generic but realistic CSS/SVG frame for the device category.

Store local assets in a predictable directory, for example:

```text
public/
  device-frames/
    ios/
    android/
    windows/
    macos/
    generic/
```

Maintain explicit asset mapping by device ID or device family. Use local assets at runtime when available.

Do not:
- Use a random unrelated product image for a specific model.
- Stretch a device image to fit arbitrary dimensions.
- assume external image URLs will always load.
- copy assets without checking their usage/license terms.
- label a generic frame as an exact model-specific hardware render.

### 7.2 DeviceFrame component

Create a reusable component that:
- Accepts the selected `Device` as a prop.
- Selects the correct local frame or fallback.
- Preserves frame aspect ratio using `object-contain` or equivalent sizing.
- Supports portrait and landscape orientations when appropriate.
- Handles image loading errors.
- Displays a sensible fallback if the image is missing.
- Updates correctly when the selected device changes.

### 7.3 Screen area

Keep the hardware frame separate from its screen content. The screen can contain:
- A neutral screen placeholder/skeleton.
- An optional screenshot image.
- In a later phase, a live website preview using an iframe where the target website permits embedding.

If using an iframe:
- Validate and normalize URLs.
- Handle sites that block embedding.
- Provide a fallback message.
- Do not imply that an iframe is equivalent to a real remote device session.

### 7.4 Hardware skeleton versus loading skeleton

The primary requirement is a device hardware frame/silhouette containing a screen area. A website loading skeleton can be rendered inside that screen, but it must not replace the hardware frame itself.

## 8. Component Architecture

Reuse existing components if they already serve the same purpose. Otherwise, organize the feature into focused components.

Suggested structure (adapt to the project):

```text
src/
  app/
    device-lab/
      page.tsx
  components/
    device-lab/
      DeviceLabPage.tsx
      NavigationRail.tsx
      WorkspacePanel.tsx
      PromotionBanner.tsx
      BrowserToolbar.tsx
      DeviceSidebar.tsx
      PlatformSelector.tsx
      OSVersionList.tsx
      DeviceSearch.tsx
      DeviceGrid.tsx
      DeviceCard.tsx
      DevicePreview.tsx
      DeviceFrame.tsx
      DeviceScreen.tsx
      PreviewToolbar.tsx
      AccessRequestPanel.tsx
      SupportWidget.tsx
  data/
    devices.ts
  types/
    device.ts
public/
  device-frames/
    ios/
    android/
    windows/
    macos/
    generic/
```

Pages Router projects should use their existing `pages/` structure instead. Do not move the entire project to a different routing architecture just to match this example.

### Component responsibilities

- `DeviceLabPage`: page composition and shared feature state.
- `NavigationRail`: primary vertical navigation.
- `WorkspacePanel`: central workspace surface and layout.
- `PromotionBanner`: promotional message and CTA.
- `BrowserToolbar`: URL field and toolbar actions.
- `DeviceSidebar`: Favorites, Recent, and platform categories.
- `PlatformSelector`: platform selection behavior.
- `OSVersionList`: OS-version filtering.
- `DeviceSearch`: search input and clear action.
- `DeviceGrid`: filtered, responsive device listing.
- `DeviceCard`: individual device selection and favorite control.
- `DevicePreview`: selected device details and preview layout.
- `DeviceFrame`: correct frame asset or fallback silhouette.
- `DeviceScreen`: placeholder, screenshot, or future preview content.
- `PreviewToolbar`: orientation and preview controls.
- `AccessRequestPanel`: restricted-state messaging and demo request action.
- `SupportWidget`: dismissible support prompt and CTA.

Avoid creating components so tiny that they add complexity without meaningful reuse. Avoid a single huge page component.

## 9. State and Interaction Requirements

Implement these as working client-side interactions:

- Select a platform.
- Select an OS version.
- Search by device model, manufacturer, platform, or OS version.
- Clear search.
- Select a device and immediately update its preview.
- Toggle favorite status.
- Filter to favorites.
- Show recently selected devices.
- Update selected model name and dimensions.
- Switch orientation where supported.
- Expand/collapse the navigation rail.
- Dismiss the support prompt.
- Show a demo confirmation after a simulated access request.
- Show empty, restricted, and missing-asset states.

Use React state and derived filtering. Avoid direct DOM manipulation.

Recommended state concepts:
- `selectedDeviceId`
- `selectedPlatform`
- `selectedOSVersion`
- `searchQuery`
- `favoriteDeviceIds`
- `recentDeviceIds`
- `orientation`
- `isNavigationCollapsed`
- `isSupportWidgetOpen`
- `isAccessRequestDialogOpen`

Avoid maintaining redundant state that can be derived from the device registry.

If local persistence is used, make it optional and safe for client-side rendering. Avoid accessing `window` or browser storage during server rendering.

## 10. Access and Support States

### Restricted devices
- Apply a subtle disabled/overlay treatment to restricted demo items.
- Show a concise explanation.
- Provide a “Request Access” action.
- On click, show a demo confirmation or dialog.
- Clearly state that the request is simulated if no backend integration exists.

### Support widget
- Position it near the lower-right corner on desktop.
- Include a dismiss/close button.
- Include a concise support message and CTA.
- Keep it within the viewport on smaller screens.
- Make all controls keyboard accessible.

## 11. Responsive Behavior

### Desktop
- Full-height navigation rail.
- Compact central workspace.
- Multi-column device list.
- Device preview area scaled to the available space.

### Tablet
- Collapsible navigation.
- Scrollable device list.
- Avoid squeezing the device preview below usable dimensions.

### Mobile
- Use a stacked layout or switchable device-list/preview panels.
- Keep search and selection controls accessible.
- Prevent horizontal overflow.
- Ensure buttons have practical touch targets.
- Scale the frame without distortion.

## 12. Visual Quality and Accessibility

- Follow the reference screenshot's visual hierarchy and compact density.
- Use blue for active selection and green for primary actions, as appropriate.
- Keep typography, spacing, borders, and shadows consistent.
- Use existing design tokens and Tailwind utilities.
- Add restrained hover and focus transitions.
- Avoid excessive animation.
- Use semantic landmarks and headings.
- Add accessible labels to icon-only controls.
- Support keyboard interaction.
- Provide visible focus indicators and adequate contrast.
- Use stable React keys and descriptive names.
- Avoid hydration errors and invalid HTML.
- Avoid unnecessary client components and dependencies.

## 13. Implementation Sequence

### Phase 1 — Audit
- Inspect the existing project.
- Identify the correct route and styling conventions.
- Inventory reusable components and available assets.

### Phase 2 — Data and layout
- Create the typed device model and centralized sample registry.
- Build the navigation rail and workspace layout.
- Implement the banner, toolbar, category sidebar, and device list.

### Phase 3 — Device preview
- Implement the dynamic preview and device-family frame fallbacks.
- Map known devices to valid local assets.
- Add the screen area, orientation handling, and missing-asset fallback.

### Phase 4 — Interactions
- Implement search, platform and OS filters, selection, favorites, recents, access state, and support-widget dismissal.

### Phase 5 — Responsive styling
- Match desktop proportions.
- Add tablet and mobile behavior.
- Verify no distortion or horizontal overflow.

### Phase 6 — Verification
- Run available lint and type-check scripts.
- Run a production build if practical.
- Fix issues introduced by the implementation.
- Test the route and all primary interactions.
- Report any missing assets or unverified functionality.

## 14. Acceptance Criteria

The feature is ready when:

- [ ] The chosen route loads without errors.
- [ ] The overall UI closely follows the supplied screenshot.
- [ ] The implementation uses reusable components.
- [ ] Device data is centralized and typed where supported.
- [ ] Platform and OS filters work.
- [ ] Search filters the device list correctly.
- [ ] Selecting a device updates the preview immediately.
- [ ] Different device categories display appropriately shaped frames.
- [ ] Device frames preserve aspect ratios.
- [ ] Missing assets display a graceful fallback.
- [ ] Favorites and recent-device interactions work.
- [ ] Restricted devices and access-request demo states work.
- [ ] The support widget can be dismissed.
- [ ] The layout works on desktop, tablet, and mobile.
- [ ] No unrelated project behavior is broken.
- [ ] Commands and test results are reported honestly.

## 15. Codex Working Instructions

Use this document as the implementation specification.

1. Inspect the project before changing files.
2. Give a short summary of the implementation approach.
3. Implement the feature in the existing architecture.
4. Keep changes scoped to this feature.
5. Use the screenshot as the visual reference.
6. Prefer local, licensed device-frame assets and accurate SVG/CSS fallbacks.
7. Do not invent backend integrations, live device availability, or test results.
8. Run available verification commands.
9. Finish with a summary of files changed, functionality implemented, verification results, and assets still required.
